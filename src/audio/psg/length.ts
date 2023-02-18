import { PSGModule } from "./psg";

export interface LengthPSGConfig {
  enabled: boolean;
}

export class LengthPSGModule implements PSGModule {
  enabled: boolean = false;
  initialLength: number = 0;
  currentLength: number = 0;
  clock: number = 0;
  config: LengthPSGConfig;

  constructor(config: LengthPSGConfig) {
    this.config = config;
  }

  reset(): void {
    this.enabled = false;
    this.initialLength = 0;
    this.currentLength = 0;
    this.clock = 0;
  }

  trigger(): void {
    this.currentLength = this.initialLength;
    this.clock = 0;
  }

  getNextClocks(clocks: number): number {
    if (!this.enabled) return clocks;
    const width = 16384;
    const remaining = width - this.clock;
    return Math.min(clocks, remaining);
  }

  step(clocks: number): void {
    const width = 16384;
    this.clock += clocks;
    if (this.enabled && this.clock >= width) {
      this.clock = 0;
      this.currentLength = Math.min(this.currentLength + 1, 64);
      if (this.currentLength === 64) {
        this.config.enabled = false;
      }
    }
  }

  read(pos: number): number {
    if (pos === 4) {
      // NR14 - Wavelength high & control
      let output = 0x100;
      if (this.enabled) output |= 0x8;
      return output;
    }
    return 0;
  }

  write(pos: number, value: number): void {
    if (pos === 1) {
      this.initialLength = value & 0x1f;
    } else if (pos === 4) {
      // NR14 - Wavelength high & control
      this.enabled = (value & 0x40) !== 0;
    }
  }

}


