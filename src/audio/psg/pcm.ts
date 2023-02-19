import { RAM } from "../../memory/ram";
import { LengthPSGModule } from "./length";
import { PSG } from "./psg";

const OUTPUT_LEVELS = [0, 1, 0.5, 0.25];

export class PCMPSG implements PSG {
  output: number = 0;
  dacEnabled: boolean = false;
  enabled: boolean = false;

  phase: number = 0;
  phaseClock: number = 0;
  wavelength: number = 0;
  outputLevel: number = 0;

  waveTable: RAM;

  length: LengthPSGModule;

  constructor(waveTable: RAM) {
    this.length = new LengthPSGModule(this);
    this.waveTable = waveTable; 
    this.reset();
  }

  reset(): void {
    this.output = 0;
    this.dacEnabled = false;
    this.enabled = false;

    this.phase = 0;
    this.phaseClock = 0;
    this.wavelength = 0;
    this.outputLevel = 0;

    this.length.reset();
  }

  trigger(): void {
    this.output = 0;
    this.enabled = true;
    this.dacEnabled = true;
    this.phase = 0;
    this.phaseClock = 0;
    this.length.trigger();
  }

  getDebugState(): string {
    return [
      `E: ${this.enabled ? '1' : '0'} WL: ${this.wavelength.toString(16).padStart(3, '0')} (${this.getHz()}Hz) V: ${this.outputLevel}`,
      this.length.getDebugState(),
    ].join(' ');
  }
  
  getHz(): number {
    return Math.floor((4 * 1024 * 1024) / (32 * 2 * (2048 - this.wavelength)));
  }

  step(clocks: number): void {
    let remainingClocks = clocks;
    while (remainingClocks > 0) {
      if (!this.enabled) break;
      // Calculate clocks for each trigger
      const phaseWidth = 2 * (2048 - this.wavelength);
      const phaseRemaining = phaseWidth - this.phaseClock;

      // Calculate the smallest trigger
      let consumedClocks = Math.min(phaseRemaining, remainingClocks);
      consumedClocks = this.length.getNextClocks(consumedClocks);

      this.phaseClock += consumedClocks;
      if (this.phaseClock >= phaseWidth) {
        this.phaseClock = 0;
        this.phase = (this.phase + 1) % 32;
      }
      this.length.step(consumedClocks);

      remainingClocks -= consumedClocks;
    }
    // Calculate current output
    if (this.enabled) {
      const readAddr = this.phase >> 1;
      const readNibble = this.phase & 1;
      const byte = this.waveTable.read(readAddr);
      const signal = ((byte >> (readNibble ? 0 : 4)) & 0xf) / 0xf;
      this.output = (signal * 2 - 1) * OUTPUT_LEVELS[this.outputLevel];
    } else {
      this.output = 0;
    }
  }

  _read(pos: number): number {
    switch (pos) {
      case 0: {
        // NR30 - DAC Enable
        let output = 0x100;
        if (this.dacEnabled) output |= 0x80;
        return output;
      }
      case 2:
        // NR32 - Output level
        return 0x100 | ((this.outputLevel & 0x3) << 5);
      case 3:
        // NR33 - Wavelength low
        return 0x100 | (this.wavelength & 0xff);
      case 4: {
        // NR34 - Wavelength high & control
        return 0x100 | ((this.wavelength >> 8) & 0x7);
      }
      default:
        return 0;
    }
  }

  read(pos: number): number {
    let output = this._read(pos);
    output |= this.length.read(pos);
    if (output & 0x100) return output;
    return 0xff;
  }

  _write(pos: number, value: number): void {
    switch (pos) {
      case 0:
        // NR30 - DAC Enable
        this.dacEnabled = (value & 0x80) !== 0;
        break;
      case 2:
        // NR32 - Output level
        this.outputLevel = (value >> 5) & 0x3;
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
    this.length.write(pos, value);
  }

}

