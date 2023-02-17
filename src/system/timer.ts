import { Memory } from "../memory/types";
import { Interrupter, INTERRUPT_TYPE } from "./interrupter";

const DIV_TICK_RATE = 256;
const TIMA_TICK_RATES = [1024, 16, 64, 256];

export class SystemTimer implements Memory {
  interrupter: Interrupter;
  clocks: number = 0;
  timaClocks: number = 0;
  tima: number = 0;
  tma: number = 0;
  tac: number = 0;

  constructor(interrupter: Interrupter) {
    this.interrupter = interrupter;
    this.reset();
  }

  reset() {
    this.clocks = 0xA7 * DIV_TICK_RATE;
    this.timaClocks = 0;
    this.tima = 0;
    this.tma = 0;
    this.tac = 0;
  }

  getDebugState(): string {
    return `DIV: ${this.read(0x4).toString(16).padStart(2, '0')} TIMA: ${this.read(0x5).toString(16).padStart(2, '0')} TMA: ${this.read(0x6).toString(16).padStart(2, '0')} TAC: ${this.read(7).toString(16).padStart(2, '0')}`;
  }

  getNextWakeupClockAdvance(): number {
    if (this.tac & 0x4) {
      const tickRate = TIMA_TICK_RATES[this.tac & 0x3];
      return 0x100 * tickRate - this.timaClocks;
    }
    return 0x7fffffff;
  }

  // NOTE: The clock may not directly correspond to the CPU.
  advanceClock(clocks: number): void {
    if (this.tac & 0x4) {
      this.timaClocks += clocks;
      const tickRate = TIMA_TICK_RATES[this.tac & 0x3];
      if ((this.timaClocks / tickRate) > 0xff) {
        this.timaClocks = this.tma * tickRate;
        // Generate interrupt
        this.interrupter.queueInterrupt(INTERRUPT_TYPE.TIMER_OVERFLOW);
      }
    }
    this.clocks += clocks;
  }

  read(pos: number): number {
    // FF00...FF0F
    switch (pos) {
      case 0x4:
        return (this.clocks / DIV_TICK_RATE) & 0xff;
      case 0x5: {
        const tickRate = TIMA_TICK_RATES[this.tac & 0x3];
        return (this.timaClocks / tickRate) & 0xff;
      }
      case 0x6:
        return this.tma;
      case 0x7:
        return this.tac;
      default:
        return 0xff;
    }
  }

  write(pos: number, value: number): void {
    // FF00...FF0F
    switch (pos) {
      case 0x4:
        this.clocks = 0;
        return;
      case 0x5: {
        const tickRate = TIMA_TICK_RATES[this.tac & 0x3];
        this.timaClocks = tickRate * value;
        return;
      }
      case 0x6:
        this.tma = value;
        return;
      case 0x7:
        this.tac = value;
        return;
    }
  }
}
