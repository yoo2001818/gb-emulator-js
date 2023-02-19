import { PSGModule } from "./psg";

export class EnvelopePSGModule implements PSGModule {
  initialVolume: number = 0;
  currentVolume: number = 0;
  increasing: boolean = false;
  pace: number = 0;
  clock: number = 0;

  reset(): void {
    this.initialVolume = 0;
    this.currentVolume = 0;
    this.increasing = false;
    this.pace = 0;
    this.clock = 0;
  }

  trigger(): void {
    this.currentVolume = this.initialVolume;
    this.clock = 0;
  }

  getDebugState(): string {
    return `V: ${this.currentVolume.toString(16)} EP: ${this.increasing ? '+' : '-'}${this.pace.toString(16)}`;
  }

  get(): number {
    return this.currentVolume / 0xf;
  }

  getNextClocks(clocks: number): number {
    if (this.pace === 0) return clocks;
    const width = 65536 * this.pace;
    const remaining = width - this.clock;
    return Math.min(clocks, remaining);
  }

  step(clocks: number): void {
    const width = 65536 * this.pace;
    this.clock += clocks;
    if (this.pace > 0 && this.clock >= width) {
      this.clock = 0;
      if (this.increasing) {
        this.currentVolume = Math.min(this.currentVolume + 1, 0xf);
      } else {
        this.currentVolume = Math.max(this.currentVolume - 1, 0);
      }
    }
  }

  read(pos: number): number {
    if (pos === 2) {
      // NR12 - Volume & envelope
      let output = 0x100;
      output |= this.pace & 0x7;
      if (this.increasing) output |= 0x8;
      output |= (this.initialVolume & 0xf) << 4;
      return output;
    }
    return 0;
  }

  write(pos: number, value: number): void {
    if (pos === 2) {
      // NR12 - Volume & envelope
      this.pace = value & 0x7;
      this.increasing = (value & 0x8) !== 0;
      this.initialVolume = (value >> 4) & 0xf;
    }
  }

}

