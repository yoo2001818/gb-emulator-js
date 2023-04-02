import { EnvelopePSGModule } from "./envelope";
import { LengthPSGModule } from "./length";
import { PSG } from "./psg";

const SERIALIZE_FIELDS: (keyof NoisePSG)[] = [
  'enabled',
  'phaseClock',
  'clockShift',
  'clockDivider',
  'lfsr',
  'lfsr7Bit',
];

export class NoisePSG implements PSG {
  output: number = 0;
  enabled: boolean = false;

  phaseClock: number = 0;
  clockShift: number = 0;
  clockDivider: number = 0;
  lfsr: number = 0;
  lfsr7Bit: boolean = false;

  envelope: EnvelopePSGModule;
  length: LengthPSGModule;

  constructor() {
    this.envelope = new EnvelopePSGModule();
    this.length = new LengthPSGModule(this);
    this.reset();
  }

  reset(): void {
    this.output = 0;
    this.enabled = false;

    this.phaseClock = 0;
    this.clockShift = 0;
    this.clockDivider = 0;
    this.lfsr = 0;
    this.lfsr7Bit = false;

    this.envelope.reset();
    this.length.reset();
  }

  serialize(): any {
    const output: any = {};
    SERIALIZE_FIELDS.forEach((key) => output[key] = this[key]);
    output.envelope = this.envelope.serialize();
    output.length = this.length.serialize();
    return output;
  }

  deserialize(data: any): void {
    SERIALIZE_FIELDS.forEach((key) => (this[key] as any) = data[key]);
    this.envelope.deserialize(data.envelope);
    this.length.deserialize(data.length);
  }

  trigger(): void {
    this.output = 0;
    this.enabled = true;
    this.phaseClock = 0;
    this.lfsr = 0;
    this.envelope.trigger();
    this.length.trigger();
  }

  getDebugState(): string {
    let r = this.clockDivider;
    if (r === 0) r = 0.5;
    const phaseWidth = 16 * r * (1 << this.clockShift);
    const hz = Math.floor((4 * 1024 * 1024) / phaseWidth);
    return [
      `E: ${this.enabled ? '1' : '0'} S: ${this.clockShift} D: ${this.clockDivider} (${hz}Hz)`,
      this.envelope.getDebugState(),
      this.length.getDebugState(),
    ].join(' ');
  }

  step(clocks: number): void {
    let remainingClocks = clocks;
    while (remainingClocks > 0) {
      if (!this.enabled) break;
      // Calculate clocks for each trigger
      // The clock is 262144 / (r * (2^s)) Hz, where r is 0.5 when r = 0
      // Meaning that this is triggered every 16 * r * 2^s clocks.
      let r = this.clockDivider;
      if (r === 0) r = 0.5;
      const phaseWidth = 16 * r * (1 << this.clockShift);
      const phaseRemaining = phaseWidth - this.phaseClock;

      // Calculate the smallest trigger
      let consumedClocks = Math.min(phaseRemaining, remainingClocks);
      consumedClocks = this.envelope.getNextClocks(consumedClocks);
      consumedClocks = this.length.getNextClocks(consumedClocks);

      this.phaseClock += consumedClocks;
      if (this.phaseClock >= phaseWidth) {
        this.phaseClock = 0;

        // Update LFSR
        const setBit = this.lfsr7Bit ? 0x8080 : 0x8000;
        let lfsr = this.lfsr
        lfsr = lfsr | (((lfsr & 1) !== ((lfsr >> 1) & 1)) ? 0 : setBit);
        lfsr = lfsr >>> 1;
        this.lfsr = lfsr;
      }
      this.envelope.step(consumedClocks);
      this.length.step(consumedClocks);

      remainingClocks -= consumedClocks;
    }
    // Calculate current output
    if (this.enabled) {
      const signal = this.lfsr & 1;
      this.output = (signal ? -1 : 1) * this.envelope.get();
    } else {
      this.output = 0;
    }
  }

  _read(pos: number): number {
    switch (pos) {
      case 3:
        // NR13 - Frequency & randomness
        let output = 0x100;
        output |= (this.clockShift & 0xf) << 4;
        if (this.lfsr7Bit) output |= 0x8;
        output |= this.clockDivider & 0x7;
        return output;
      default:
        return 0;
    }
  }

  read(pos: number): number {
    let output = this._read(pos);
    output |= this.envelope.read(pos);
    output |= this.length.read(pos);
    if (output & 0x100) return output;
    return 0xff;
  }

  _write(pos: number, value: number): void {
    switch (pos) {
      case 3:
        // NR13 - Frequency & randomness
        this.clockShift = (value >> 4) & 0xf;
        this.lfsr7Bit = (value & 0x8) !== 0;
        this.clockDivider = value & 0x7;
        break;
      case 4: 
        // NR44 - Control
        if (value & 0x80) this.trigger();
        break;
    }
  }

  write(pos: number, value: number): void {
    this._write(pos, value);
    this.envelope.write(pos, value);
    this.length.write(pos, value);
  }

}
