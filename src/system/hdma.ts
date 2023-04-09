import { BaseEmulator } from './baseEmulator';
import { BaseSystem } from './baseSystem';
import { SystemType } from './systemType';

const SERIALIZE_FIELDS: (keyof HDMA)[] = [
  'src',
  'dest',
  'useHBlank',
  'isRunning',
  'length',
  'pos',
];

export class HDMA {
  src: number = 0;
  dest: number = 0; 
  useHBlank: boolean = false;
  isRunning: boolean = false;
  length: number = 0;
  pos: number = 0;
  remainingInCycle: number = 0;
  system: BaseSystem | null = null;
  emulator: BaseEmulator | null = null;

  serialize(): any {
    const output: any = {};
    SERIALIZE_FIELDS.forEach((key) => output[key] = this[key]);
    return output;
  }

  deserialize(data: any): void {
    SERIALIZE_FIELDS.forEach((key) => (this[key] as any) = data[key]);
  }

  reset(): void {
    this.src = 0;
    this.dest = 0;
    this.useHBlank = false;
    this.isRunning = false;
    this.length = 0;
    this.pos = 0;
  }

  register(system: BaseSystem, emulator: BaseEmulator): void {
    this.system = system;
    this.emulator = emulator;
    if (system.type !== SystemType.CGB) return;
    const { ioBus } = system;
    ioBus.register(0x51, 'HDMA1', {
      read: () => (this.src >>> 8) & 0xff,
      write: (_, value) => {
        this.src = (this.src & 0xff) | (value << 8);
      },
    });
    ioBus.register(0x52, 'HDMA2', {
      read: () => this.src & 0xff,
      write: (_, value) => {
        this.src = (this.src & 0xff00) | value;
      },
    });
    ioBus.register(0x53, 'HDMA3', {
      read: () => (this.dest >>> 8) & 0xff,
      write: (_, value) => {
        this.dest = (this.dest & 0xff) | (value << 8);
      },
    });
    ioBus.register(0x54, 'HDMA4', {
      read: () => this.dest & 0xff,
      write: (_, value) => {
        this.dest = (this.dest & 0xff00) | value;
      },
    });
    ioBus.register(0x55, 'HDMA5', {
      read: () => {
        const remaining = this.length - this.pos;
        if (remaining === 0) return 0xff;
        let output = (Math.floor(remaining / 0x10)) & 0x7f;
        if (!this.isRunning) output |= 0x80;
        return output;
      },
      write: (_, value) => {
        if (!this.isRunning) {
          this.isRunning = true;
          this.useHBlank = (value & 0x80) !== 0;
          this.pos = 0;
          this.length = ((value & 0x7f) + 1) * 0x10;
          if (!this.useHBlank) {
            // Hang the CPU for the necessary time
            const isDoubleSpeed = (this.system!.memoryBus.read(0xff4d) & 0x80) !== 0;
            if (isDoubleSpeed) {
              this.system!.cpu.tick(this.length);
            } else {
              this.system!.cpu.tick(this.length / 2);
            }
          } else {
            if (this.emulator!.ppu.mode === 0) {
              // Enter HBlank immediately
              this.remainingInCycle = 0x10;
              this.system!.cpu.isBlocked = true;
            } else {
              this.remainingInCycle = 0;
            }
          }
        } else {
          this.isRunning = false;
          this.system!.cpu.isBlocked = false;
        }
      },
    });
  }

  enterHBlank(): void {
    if (!this.isRunning || !this.useHBlank) return;
    this.remainingInCycle = 0x10;
    this.system!.cpu.isBlocked = true;
  }

  advanceClock(): void {
    if (!this.isRunning) return;
    // FIXME: Stall the CPU when we're copying HDMA data in general-purpose mode
    if (this.useHBlank) {
      const mode = this.emulator!.ppu.mode;
      if (mode !== 0 || this.remainingInCycle <= 0) {
        this.system!.cpu.isBlocked = false;
        return;
      }
    }
    const memory = this.system!.cpu.memory;
    const { src, dest, length } = this;
    const realSrc = src & 0xfff0;
    const realDest = (dest & 0x1ff0) + 0x8000;
    // Copy 2 bytes in one M-clock
    for (let i = 0; i < 2; i += 1) {
      const pos = this.pos;
      const value = memory.read(realSrc + pos);
      memory.write(realDest + pos, value);
      this.pos += 1;
      this.remainingInCycle -= 1;
      if (this.pos === length) {
        this.system!.cpu.isBlocked = false;
        this.isRunning = false;
        this.pos = 0;
        this.length = 0;
        break;
      }
    }
  }
}
