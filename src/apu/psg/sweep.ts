import { PSGModule } from "./psg";

const SERIALIZE_FIELDS: (keyof SweepPSGModule)[] = [
  'initialPace',
  'pace',
  'increasing',
  'slope',
  'clock',
];

export interface SquarePSGConfig {
  enabled: boolean;
  wavelength: number;
}

export class SweepPSGModule implements PSGModule {
  initialPace: number = 0;
  pace: number = 0;
  increasing: boolean = false;
  slope: number = 0;
  clock: number = 0;
  config: SquarePSGConfig;

  constructor(config: SquarePSGConfig) {
    this.config = config;
  }

  reset(): void {
    this.initialPace = 0;
    this.pace = 0;
    this.increasing = false;
    this.slope = 0;
    this.clock = 0;
  }

  serialize(): any {
    const output: any = {};
    SERIALIZE_FIELDS.forEach((key) => output[key] = this[key]);
    return output;
  }

  deserialize(data: any): void {
    SERIALIZE_FIELDS.forEach((key) => (this[key] as any) = data[key]);
  }

  trigger(): void {
    this.clock = 0;
    this.pace = this.initialPace;
  }

  getDebugState(): string {
    return `SP: ${this.increasing ? '+' : '-'}${this.pace.toString(16)} ${this.slope.toString(16)}`;
  }

  getNextClocks(clocks: number): number {
    if (this.pace === 0) return clocks;
    const width = 32768 * this.pace;
    const remaining = width - this.clock;
    return Math.min(clocks, remaining);
  }

  step(clocks: number): void {
    const width = 32768 * this.pace;
    this.clock += clocks;
    if (this.pace > 0 && this.clock >= width) {
      this.clock = 0;
      const wavelength = this.config.wavelength;
      const nextWavelength = wavelength + (wavelength >>> this.slope) * (this.increasing ? 1 : -1);
      if (nextWavelength >= 0x7ff) {
        this.config.enabled = false;
        this.config.wavelength = 0x7ff;
      } else {
        this.config.wavelength = nextWavelength;
      }
    }
  }

  read(pos: number): number {
    if (pos === 0) {
      // NR10 - Sweep
      let output = 0x100;
      output |= this.slope & 0x7;
      if (!this.increasing) output |= 0x8;
      output |= (this.initialPace & 0x7) << 4;
      return output;
    }
    return 0;
  }

  write(pos: number, value: number): void {
    if (pos === 0) {
      // NR10 - Sweep
      this.slope = value & 0x7;
      this.increasing = (value & 0x8) === 0;
      this.initialPace = (value >> 4) & 0x7;
      if (this.initialPace === 0) {
        this.pace = 0;
      } else if (this.pace === 0) {
        this.pace = this.initialPace;
      }
    }
  }

}
