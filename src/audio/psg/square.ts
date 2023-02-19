import { EnvelopePSGModule } from "./envelope";
import { LengthPSGModule } from "./length";
import { PSG } from "./psg";
import { SweepPSGModule } from "./sweep";

const DUTY_CYCLE_TABLE = [
  0xFE, 0x7E, 0x78, 0x81,
];

export class SquarePSG implements PSG {
  output: number = 0;
  enabled: boolean = false;

  phase: number = 0;
  phaseClock: number = 0;
  wavelength: number = 0;
  dutyCycle: number = 0;

  sweep: SweepPSGModule;
  envelope: EnvelopePSGModule;
  length: LengthPSGModule;

  hasSweep: boolean;

  constructor(hasSweep?: boolean) {
    this.hasSweep = hasSweep ?? true;
    this.sweep = new SweepPSGModule(this);
    this.envelope = new EnvelopePSGModule();
    this.length = new LengthPSGModule(this);
    this.reset();
  }

  reset(): void {
    this.output = 0;
    this.enabled = false;

    this.phase = 0;
    this.phaseClock = 0;
    this.wavelength = 0;
    this.dutyCycle = 0;

    this.sweep.reset();
    this.envelope.reset();
    this.length.reset();
  }

  trigger(): void {
    this.output = 0;
    this.enabled = true;
    this.phase = 0;
    this.phaseClock = 0;
    this.sweep.trigger();
    this.envelope.trigger();
    this.length.trigger();
  }

  getDebugState(): string {
    return [
      `E: ${this.enabled ? '1' : '0'} WL: ${this.wavelength.toString(16).padStart(3, '0')} (${this.getHz()}Hz) DC: ${this.dutyCycle}`,
      this.hasSweep ? this.sweep.getDebugState() : '',
      this.envelope.getDebugState(),
      this.length.getDebugState(),
    ].filter((v) => v !== '').join(' ');
  }
  
  getHz(): number {
    return Math.floor((4 * 1024 * 1024) / (8 * 4 * (2048 - this.wavelength)));
  }

  step(clocks: number): void {
    let remainingClocks = clocks;
    while (remainingClocks > 0) {
      if (!this.enabled) break;
      // Calculate clocks for each trigger
      const phaseWidth = 4 * (2048 - this.wavelength);
      const phaseRemaining = phaseWidth - this.phaseClock;

      // Calculate the smallest trigger
      let consumedClocks = Math.min(phaseRemaining, remainingClocks);
      if (this.hasSweep) consumedClocks = this.sweep.getNextClocks(consumedClocks);
      consumedClocks = this.envelope.getNextClocks(consumedClocks);
      consumedClocks = this.length.getNextClocks(consumedClocks);

      this.phaseClock += consumedClocks;
      if (this.phaseClock >= phaseWidth) {
        this.phaseClock = 0;
        this.phase = (this.phase + 1) % 8;
      }
      if (this.hasSweep) this.sweep.step(consumedClocks);
      this.envelope.step(consumedClocks);
      this.length.step(consumedClocks);

      remainingClocks -= consumedClocks;
    }
    // Calculate current output
    if (this.enabled) {
      const signal = (DUTY_CYCLE_TABLE[this.dutyCycle] >> (7 - this.phase)) & 1;
      this.output = (signal ? -1 : 1) * this.envelope.get();
    } else {
      this.output = 0;
    }
  }

  _read(pos: number): number {
    switch (pos) {
      case 1: 
        // NR11 - Length timer & duty cycle
        return 0x100 | ((this.dutyCycle & 0x3) << 6);
      case 3:
        // NR13 - Wavelength low
        return 0x100 | (this.wavelength & 0xff);
      case 4: {
        // NR14 - Wavelength high & control
        return 0x100 | ((this.wavelength >> 8) & 0x7);
      }
      default:
        return 0;
    }
  }

  read(pos: number): number {
    let output = this._read(pos);
    if (this.hasSweep) output |= this.sweep.read(pos);
    output |= this.envelope.read(pos);
    output |= this.length.read(pos);
    if (output & 0x100) return output;
    return 0xff;
  }

  _write(pos: number, value: number): void {
    switch (pos) {
      case 1: 
        // NR11 - Length timer & duty cycle
        this.dutyCycle = (value >> 6) & 0x3;
        break;
      case 3:
        // NR13 - Wavelength low
        this.wavelength = (this.wavelength & 0x700) | (value & 0xff);
        break;
      case 4: 
        // NR14 - Wavelength high & control
        this.wavelength = (this.wavelength & 0xff) | ((value & 0x7) << 8);
        if (value & 0x80) this.trigger();
        break;
    }
  }

  write(pos: number, value: number): void {
    this._write(pos, value);
    if (this.hasSweep) this.sweep.write(pos, value);
    this.envelope.write(pos, value);
    this.length.write(pos, value);
  }

}
