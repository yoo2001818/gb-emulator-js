import { PSG } from "./psg";

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

  lengthEnabled: boolean = false;
  initialLength: number = 0;
  currentLength: number = 0;
  lengthClock: number = 0;

  initialVolume: number = 0;
  currentVolume: number = 0;
  envelopeIncreasing: boolean = false;
  envelopePace: number = 0;
  envelopeClock: number = 0;

  sweepPace: number = 0;
  sweepIncreasing: boolean = false;
  sweepSlope: number = 0;
  sweepClock: number = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.output = 0;
    this.enabled = false;

    this.phase = 0;
    this.phaseClock = 0;
    this.wavelength = 0;
    this.dutyCycle = 0;

    this.lengthEnabled = false;
    this.initialLength = 0;
    this.currentLength = 0;
    this.lengthClock = 0;

    this.initialVolume = 0;
    this.currentVolume = 0;
    this.envelopeIncreasing = false;
    this.envelopePace = 0;
    this.envelopeClock = 0;

    this.sweepPace = 0;
    this.sweepIncreasing = false;
    this.sweepSlope = 0;
    this.sweepClock = 0;
  }

  trigger(): void {
    this.output = 0;
    this.enabled = true;
    this.phase = 0;
    this.phaseClock = 0;
    this.envelopeClock = 0;
    this.lengthClock = 0;
    this.sweepClock = 0;
    this.currentLength = this.initialLength;
    this.currentVolume = this.initialVolume;
  }

  getDebugState(): string {
    return [
      `E: ${this.enabled} WL: ${this.wavelength} DC: ${this.dutyCycle} E: ${this.envelopePace} V: ${this.currentVolume} C: ${this.currentLength}`,
    ].join('\n');
  }

  step(clocks: number): void {
    let remainingClocks = clocks;
    while (remainingClocks > 0) {
      if (!this.enabled) break;
      // Calculate clocks for each trigger
      const phaseWidth = 4 * (2048 - this.wavelength);
      const lengthWidth = 16384;
      const envelopeWidth = 65536 * this.envelopePace;
      const sweepWidth = 65536 * this.sweepPace;

      const phaseRemaining = phaseWidth - this.phaseClock;
      const lengthRemaining = lengthWidth - this.lengthClock;
      const envelopeRemaining = envelopeWidth - this.envelopeClock;
      const sweepRemaining = sweepWidth - this.sweepClock;

      // Calculate the smallest trigger
      let consumedClocks = Math.min(phaseRemaining, remainingClocks);
      if (this.lengthEnabled && consumedClocks > lengthRemaining) {
        consumedClocks = lengthRemaining;
      }
      if (this.envelopePace > 0 && consumedClocks > envelopeRemaining) {
        consumedClocks = envelopeRemaining;
      }
      if (this.sweepPace > 0 && consumedClocks > sweepRemaining) {
        consumedClocks = sweepRemaining;
      }
      this.phaseClock += consumedClocks;
      this.lengthClock += consumedClocks;
      this.envelopeClock += consumedClocks;
      this.sweepClock += consumedClocks;

      if (this.phaseClock >= phaseWidth) {
        this.phaseClock = 0;
        this.phase = (this.phase + 1) % 8;
      }
      if (this.lengthEnabled && this.lengthClock >= lengthWidth) {
        this.lengthClock = 0;
        this.currentLength += 1;
        if (this.currentLength >= 64) {
          this.enabled = false;
        }
      }
      if (this.envelopePace > 0 && this.envelopeClock >= envelopeWidth) {
        this.envelopeClock = 0;
        if (this.envelopeIncreasing) {
          this.currentVolume = Math.min(this.currentVolume + 1, 0xf);
        } else {
          this.currentVolume = Math.max(this.currentVolume - 1, 0);
        }
      }
      if (this.sweepPace > 0 && this.sweepClock >= sweepWidth) {
        this.sweepClock = 0;
        const nextWavelength = this.wavelength + Math.floor(this.wavelength / (1 << this.sweepSlope) * (this.sweepIncreasing ? 1 : -1));
        if (nextWavelength > 0x7ff) {
          this.enabled = false;
          this.wavelength = 0x7ff;
        } else {
          this.wavelength = nextWavelength;
        }
      }

      remainingClocks -= consumedClocks;
    }
    // Calculate current output
    if (this.enabled) {
      const signal = (DUTY_CYCLE_TABLE[this.dutyCycle] >> (7 - this.phase)) & 1;
      this.output = (signal ? -1 : 1) * (this.currentVolume / 0xf);
    } else {
      this.output = 0;
    }
  }

  read(pos: number): number {
    switch (pos) {
      case 0: {
        // NR10 - Sweep
        let output = 0;
        output |= this.sweepSlope & 0x7;
        if (!this.sweepIncreasing) output |= 0x8;
        output |= (this.sweepPace & 0xf) << 4;
        return output;
      }
      case 1: 
        // NR11 - Length timer & duty cycle
        return (this.dutyCycle & 0x3) << 6;
      case 2: {
        // NR12 - Volume & envelope
        let output = 0;
        output |= this.envelopePace & 0x7;
        if (this.envelopeIncreasing) output |= 0x8;
        output |= (this.initialVolume & 0xf) << 4;
        return output;
      }
      case 3:
        // NR13 - Wavelength low
        return this.wavelength & 0xff;
      case 4: {
        // NR14 - Wavelength high & control
        let output = 0;
        output |= (this.wavelength >> 8) & 0x7;
        if (this.lengthEnabled) output |= 0x8;
        return output;
      }
      default:
        return 0xff;
    }
  }

  write(pos: number, value: number): void {
    switch (pos) {
      case 0:
        // NR10 - Sweep
        this.sweepSlope = value & 0x7;
        this.sweepIncreasing = (value & 0x8) === 0;
        this.sweepPace = (value >> 4) & 0xf;
        break;
      case 1: 
        // NR11 - Length timer & duty cycle
        this.dutyCycle = (value >> 6) & 0x3;
        this.initialLength = value & 0x1f;
        break;
      case 2: 
        // NR12 - Volume & envelope
        this.envelopePace = value & 0x7;
        this.envelopeIncreasing = (value & 0x8) !== 0;
        this.initialVolume = (value >> 4) & 0xf;
        break;
      case 3:
        // NR13 - Wavelength low
        this.wavelength = (this.wavelength & 0x700) | (value & 0xff);
        break;
      case 4: 
        // NR14 - Wavelength high & control
        this.wavelength = (this.wavelength & 0xff) | ((value & 0x7) << 8);
        this.lengthEnabled = (value & 0x40) !== 0;
        if (value & 0x80) this.trigger();
        break;
    }
  }

}
