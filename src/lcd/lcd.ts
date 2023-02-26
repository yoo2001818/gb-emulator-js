import { LockableRAM } from '../memory/lockableRAM';
import { Memory } from '../memory/types';
import { Interrupter, INTERRUPT_TYPE } from '../system/interrupter';
import { renderLine } from './render';

export const LCD_IO = {
  LCDC: 0,
  STAT: 1,
  SCY: 2,
  SCX: 3,
  LY: 4,
  LYC: 5,
  DMA: 6,
  BGP: 7,
  OBP0: 8,
  OBP1: 9,
  WY: 0xa,
  WX: 0xb,
};

export const LCDC = {
  BG_WINDOW_DISPLAY: 1,
  OBJ_DISPLAY: 2,
  OBJ_SIZE: 4,
  BG_TILE_MAP_DISPLAY_SELECT: 8,
  BG_WINDOW_TILE_DATA_SELECT: 16,
  WINDOW_DISPLAY: 32,
  WINDOW_TILE_MAP_DISPLAY_SELECT: 64,
  ENABLED: 128,
};

const VBLANK_LY = 144;
const MAX_LY = 153;

const LINE_CLOCK_MODE_0 = 208; // H-Blank
const LINE_CLOCK_MODE_2 = 80; // OAM scanning
const LINE_CLOCK_MODE_3 = 168; // Rendering
const LINE_CLOCK_MODE_23 = LINE_CLOCK_MODE_2 + LINE_CLOCK_MODE_3;
const LINE_CLOCK_MODE_230 = LINE_CLOCK_MODE_23 + LINE_CLOCK_MODE_0;
const LINE_CLOCK_VBLANK = 456; // V-Blank (each scanline)

export const LCD_WIDTH = 160;
export const LCD_HEIGHT = 144;

export class LCD implements Memory {
  interrupter!: Interrupter;
  lcdc: number = 0;
  stat: number = 0;
  scy: number = 0;
  scx: number = 0;
  ly: number = 0;
  lyc: number = 0;
  bgp: number = 0;
  obp0: number = 0;
  obp1: number = 0;
  wy: number = 0;
  wx: number = 0;
  // Clock used by each LY.
  lineClock: number = 0;
  clocks: number = 0;
  mode: number = 0;
  runVblank: boolean = false;
  dmaSrc: number = 0;
  dmaPos: number = -1;
  dmaClocks: number = 0;
  framebuffer!: Uint16Array;
  vram!: LockableRAM;
  oam!: LockableRAM;

  constructor(interrupter: Interrupter) {
    this.setInterrupter(interrupter);
    this.reset();
  }

  getDebugState(): string {
    return [
      `LCDC: ${this.read(LCD_IO.LCDC).toString(16).padStart(2, '0')} STAT: ${this.read(LCD_IO.STAT).toString(16).padStart(2, '0')}`,
      `LY: ${this.read(LCD_IO.LY).toString(16).padStart(2, '0')} LYC: ${this.read(LCD_IO.LYC).toString(16).padStart(2, '0')}`,
      `LCLK: ${this.lineClock} CLK: ${this.clocks}`
    ].join('\n');
  }

  read(pos: number): number {
    // pos is 0 ~ F. The memory bus would use FF40 ~ FF4F
    switch (pos) {
      case LCD_IO.LCDC:
        return this.lcdc;
      case LCD_IO.STAT: {
        let bits = (this.stat & 0xf8);
        bits |= this.mode;
        if (this.ly === this.lyc) bits |= 4;
        return bits;
      }
      case LCD_IO.SCY:
        return this.scy;
      case LCD_IO.SCX:
        return this.scx;
      case LCD_IO.LY:
        return this.ly;
      case LCD_IO.LYC:
        return this.lyc;
      case LCD_IO.DMA:
        return 0xff;
      case LCD_IO.BGP:
        return this.bgp;
      case LCD_IO.OBP0:
        return this.obp0;
      case LCD_IO.OBP1:
        return this.obp1;
      case LCD_IO.WY:
        return this.wy;
      case LCD_IO.WX:
        return this.wx;
      default:
        return 0xff;
    }
  }

  write(pos: number, value: number): void {
    // pos is 0 ~ F. The memory bus would use FF40 ~ FF4F
    switch (pos) {
      case LCD_IO.LCDC:
        this.lcdc = value;
        return;
      case LCD_IO.STAT:
        this.stat = value;
        return;
      case LCD_IO.SCY:
        this.scy = value;
        return;
      case LCD_IO.SCX:
        this.scx = value;
        return;
      case LCD_IO.LY:
        this.ly = value;
        return;
      case LCD_IO.LYC:
        this.lyc = value;
        return;
      case LCD_IO.DMA: {
        // Perform DMA operation
        const source = value << 8;
        this.dmaSrc = source;
        this.dmaClocks = -4;
        this.dmaPos = 0;
        return;
      }
      case LCD_IO.BGP:
        this.bgp = value;
        return;
      case LCD_IO.OBP0:
        this.obp0 = value;
        return;
      case LCD_IO.OBP1:
        this.obp1 = value;
        return;
      case LCD_IO.WY:
        this.wy = value;
        return;
      case LCD_IO.WX:
        this.wx = value;
        return;
    }
  }

  setInterrupter(interrupter: Interrupter): void {
    this.interrupter = interrupter;
  }

  reset() {
    this.lcdc = 0x91;
    this.stat = 0;
    this.scy = 0;
    this.scx = 0;
    this.ly = 0;
    this.lyc = 0;
    this.bgp = 0xfc;
    this.obp0 = 0xff;
    this.obp1 = 0xff;
    this.wy = 0;
    this.wx = 0;
    this.lineClock = 0;
    this.clocks = 0;
    this.mode = 0;
    this.dmaPos = -1;
    this.dmaClocks = 0;
    this.dmaSrc = 0;
    this.framebuffer = new Uint16Array(LCD_WIDTH * LCD_HEIGHT);
    this.vram = new LockableRAM(0x2000, () => false);
    this.oam = new LockableRAM(0x100, () => {
      if (this.dmaPos >= 0) return true;
      return false;
    });
  }

  handleLineChange(): void {
    this.lineClock = 0;
    if (this.ly > MAX_LY) {
      // Reset ly to the top of the screen
      this.ly = 0;
    }
    if (this.ly === this.lyc && (this.stat & 0x40)) {
      // LYC=LY interrupt requested
      this.interrupter.queueInterrupt(INTERRUPT_TYPE.LCDC);
    }
    if (this.ly < VBLANK_LY) {
      this.mode = 2;
      if (this.stat & 0x20) {
        // OAM interrupt requested
        this.interrupter.queueInterrupt(INTERRUPT_TYPE.LCDC);
      }
    } else if (this.ly === VBLANK_LY) {
      this.mode = 1;
      if (this.stat & 0x10) {
        // V-blank interrupt requested
        this.interrupter.queueInterrupt(INTERRUPT_TYPE.LCDC);
      }
      // Generate V-blank interrupt separately
      this.interrupter.queueInterrupt(INTERRUPT_TYPE.VBLANK);
    }
  }

  handleMode3Enter(): void {
    this.mode = 3;
  }

  handleMode0Enter(): void {
    this.mode = 0;
    renderLine(this, this.ly);
    if (this.stat & 0x08) {
      // H-blank interrupt requested
      this.interrupter.queueInterrupt(INTERRUPT_TYPE.LCDC);
    }
  }

  /**
   * Called in each requestAnimationFrame to reset the data to V-Blank state.
   */
  resetClock(): void {
    // FIXME: If we weren't able to finish the frame, an interrupt must be
    // generated.
    this.ly = VBLANK_LY;
    this.lineClock = 0;
    this.clocks = 0;
    this.handleLineChange();
  }

  getNextWakeupClockAdvance(): number {
    if (this.ly >= VBLANK_LY) {
      return LINE_CLOCK_VBLANK - this.lineClock;
    }
    if (this.lineClock < LINE_CLOCK_MODE_2) {
      return LINE_CLOCK_MODE_2 - this.lineClock;
    }
    if (this.lineClock < LINE_CLOCK_MODE_23) {
      return LINE_CLOCK_MODE_23 - this.lineClock;
    }
    return LINE_CLOCK_MODE_230 - this.lineClock;
  }

  advanceClock(): void {
    // Run DMA operation
    if (this.dmaPos >= 0) {
      const pos = this.dmaPos;
      const memory = this.interrupter.cpu.memory;
      this.oam.bytes[pos] = memory.read(this.dmaSrc + pos);
      this.dmaPos += 1;
      if (this.dmaPos >= 160) {
        this.dmaPos = -1;
      }
    }
    this.lineClock += 4;
    if (this.ly >= VBLANK_LY) {
      // VBlank
      if (this.lineClock >= LINE_CLOCK_VBLANK) {
        this.ly += 1;
        this.handleLineChange();
      }
    } else if (this.lineClock === LINE_CLOCK_MODE_2) {
      // OAM
      this.handleMode3Enter();
    } else if (this.lineClock === LINE_CLOCK_MODE_23) {
      // Render
      this.handleMode0Enter();
    } else if (this.lineClock === LINE_CLOCK_MODE_230) {
      // HBlank
      if (this.ly === VBLANK_LY - 1 && !this.runVblank) {
        this.lineClock = LINE_CLOCK_MODE_230 - 1;
        return;
      }
      this.ly += 1;
      this.handleLineChange();
    }
    this.clocks += 1;
  }
}
