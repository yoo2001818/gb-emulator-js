import { BankedRAM } from '../memory/bankedRAM';
import { LockableRAM } from '../memory/lockableRAM';
import { createAccessor, deserializeBytes, serializeBytes } from '../memory/utils';
import { BaseSystem } from '../system/baseSystem';
import { Interrupter, INTERRUPT_TYPE } from '../system/interrupter';
import { SystemType } from '../system/systemType';
import { renderLine } from './render';

export const LCD_IO = {
  LCDC: 0xff40,
  STAT: 0xff41,
  SCY: 0xff42,
  SCX: 0xff43,
  LY: 0xff44,
  LYC: 0xff45,
  DMA: 0xff46,
  BGP: 0xff47,
  OBP0: 0xff48,
  OBP1: 0xff49,
  WY: 0xff4a,
  WX: 0xff4b,
  VBK: 0xff4f,
  HDMA1: 0xff51,
  HDMA2: 0xff52,
  HDMA3: 0xff53,
  HDMA4: 0xff54,
  HDMA5: 0xff55,
  BCPS: 0xff68,
  BCPD: 0xff69,
  OCPS: 0xff6a,
  OCPD: 0xff6b,
  OPRI: 0xff6c,
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

const SERIALIZE_FIELDS: (keyof LCD)[] = [
  'lcdc',
  'stat',
  'scy',
  'scx',
  'ly',
  'lyc',
  'bgp',
  'obp0',
  'obp1',
  'wy',
  'wx',
  'lineClock',
  'clocks',
  'mode',
  'vramBank',
  'bcps',
  'ocps',
];

export class LCD {
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
  framebuffer!: Uint16Array;
  lineData!: Uint8Array;
  vram!: BankedRAM;
  oam!: LockableRAM;

  // CGB specific features
  isCGB: boolean = false;
  vramBank: number = 0;
  bcps: number = 0;
  ocps: number = 0;
  bgPalette!: Uint8Array;
  objPalette!: Uint8Array;
  // This is hardcoded by CGB boot ROM
  // opri: number = 0;

  constructor(interrupter: Interrupter) {
    this.setInterrupter(interrupter);
    this.reset();
  }

  serialize(): any {
    const output: any = {};
    SERIALIZE_FIELDS.forEach((key) => output[key] = this[key]);
    output.vram = this.vram.serialize();
    output.oam = this.oam.serialize();
    output.bgPalette = serializeBytes(this.bgPalette);
    output.objPalette = serializeBytes(this.objPalette);
    return output;
  }

  deserialize(data: any): void {
    SERIALIZE_FIELDS.forEach((key) => (this[key] as any) = data[key]);
    this.vram.deserialize(data.vram);
    this.oam.deserialize(data.oam);
    deserializeBytes(data.bgPalette, this.bgPalette);
    deserializeBytes(data.objPalette, this.objPalette);
  }

  getDebugState(): string {
    return [
      `LCDC: ${this.lcdc.toString(16).padStart(2, '0')} STAT: ${this.stat.toString(16).padStart(2, '0')}`,
      `LY: ${this.ly.toString(16).padStart(2, '0')} LYC: ${this.lyc.toString(16).padStart(2, '0')}`,
      `LCLK: ${this.lineClock} CLK: ${this.clocks} VBK: ${this.vramBank}`,
    ].join('\n');
  }

  setInterrupter(interrupter: Interrupter): void {
    this.interrupter = interrupter;
  }

  register(system: BaseSystem): void {
    const { ioBus, memoryBus } = system;
    this.isCGB = system.type === SystemType.CGB;
    // VRAM and OAM
    memoryBus.register(0x80, 0x9f, this.vram);
    memoryBus.register(0xfe, 0xfe, this.oam);
    // GB registers
    ioBus.register(0x40, 'LCDC', {
      read: () => this.lcdc,
      write: (_, value) => {
        if ((this.lcdc & 0x80) !== (value & 0x80)) {
          // LCD stopping / restarting
          this.ly = 0;
          this.mode = 0;
          this.lineClock = 0;
          this.clocks = 0;
        }
        this.lcdc = value;
      },
    });
    ioBus.register(0x41, 'STAT', {
      read: () => {
        let bits = (this.stat & 0xf8);
        bits |= this.mode;
        if (this.ly === this.lyc) bits |= 4;
        return bits;
      },
      write: (_, value) => {
        this.stat = value;
      },
    });
    ioBus.register(0x42, 'SCY', createAccessor(this, 'scy'));
    ioBus.register(0x43, 'SCX', createAccessor(this, 'scx'));
    ioBus.register(0x44, 'LY', createAccessor(this, 'ly'));
    ioBus.register(0x45, 'LYC', createAccessor(this, 'lyc'));
    ioBus.register(0x47, 'BGP', createAccessor(this, 'bgp'));
    ioBus.register(0x48, 'OBP0', createAccessor(this, 'obp0'));
    ioBus.register(0x49, 'OBP1', createAccessor(this, 'obp1'));
    ioBus.register(0x4a, 'WY', createAccessor(this, 'wy'));
    ioBus.register(0x4b, 'WX', createAccessor(this, 'wx'));
    if (system.type === SystemType.CGB) {
      // GBC registers
      ioBus.register(0x4f, 'VBK', {
        read: () => 0xfe | this.vramBank,
        write: (_, value) => { this.vramBank = value & 1; },
      });
      ioBus.register(0x68, 'BCPS', createAccessor(this, 'bcps'));
      ioBus.register(0x69, 'BCPD', {
        read: () => {
          const pos = this.bcps & 0x3f;
          return this.bgPalette[pos];
        },
        write: (_, value) => {
          const pos = this.bcps & 0x3f;
          const autoIncrement = (this.bcps & 0x80) !== 0;
          if (autoIncrement) {
            this.bcps = ((this.bcps + 1) & 0x3f) | (this.bcps & 0x80);
          }
          this.bgPalette[pos] = value;
        },
      });
      ioBus.register(0x6a, 'OCPS', createAccessor(this, 'ocps'));
      ioBus.register(0x6b, 'OCPD', {
        read: () => {
          const pos = this.ocps & 0x3f;
          return this.objPalette[pos];
        },
        write: (_, value) => {
          const pos = this.ocps & 0x3f;
          const autoIncrement = (this.ocps & 0x80) !== 0;
          if (autoIncrement) {
            this.ocps = ((this.ocps + 1) & 0x3f) | (this.ocps & 0x80);
          }
          this.objPalette[pos] = value;
        },
      });
    }
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
    this.framebuffer = new Uint16Array(LCD_WIDTH * LCD_HEIGHT);
    this.lineData = new Uint8Array(LCD_WIDTH);
    this.vram = new BankedRAM(0x4000, () => false, () => this.vramBank * 0x2000);
    this.oam = new LockableRAM(0x100, () => false);
    this.vramBank = 0;
    this.bcps = 0;
    this.ocps = 0;
    this.bgPalette = new Uint8Array(64);
    this.objPalette = new Uint8Array(64);
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
      this.clocks = 0;
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
    this.ly = VBLANK_LY;
    this.lineClock = 0;
    this.clocks = 0;
    this.handleLineChange();
  }

  getNextWakeupClockAdvance(): number {
    if (this.ly >= VBLANK_LY) {
      return (LINE_CLOCK_VBLANK - this.lineClock) / 4;
    }
    if (this.lineClock < LINE_CLOCK_MODE_2) {
      return (LINE_CLOCK_MODE_2 - this.lineClock) / 4;
    }
    if (this.lineClock < LINE_CLOCK_MODE_23) {
      return (LINE_CLOCK_MODE_23 - this.lineClock) / 4;
    }
    return (LINE_CLOCK_MODE_230 - this.lineClock) / 4;
  }

  getRemainingClockUntilVblank(): number {
    if ((this.lcdc & 0x80) === 0) {
      // LCD turned off; assume 17556 clocks
      return 17556;
    }
    return 17556 - this.clocks + 1;
  }

  advanceClock(): void {
    if ((this.lcdc & 0x80) === 0) {
      // LCD turned off; do nothing
      return;
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
      this.ly += 1;
      this.handleLineChange();
    }
    this.clocks += 1;
  }
}
