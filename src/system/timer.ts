import { Memory } from "../memory/types";
import { BaseSystem } from "./baseSystem";
import { Interrupter, INTERRUPT_TYPE } from "./interrupter";

const DIV_TICK_RATE = 256;
const TIMA_TICK_RATES = [1024, 16, 64, 256];
const TIMA_TICK_BITS = [512, 8, 32, 128];

const SERIALIZE_FIELDS: (keyof SystemTimer)[] = [
  'clocks',
  'tima',
  'tma',
  'tac',
  'timaDelayed',
];

export class SystemTimer implements Memory {
  interrupter: Interrupter;
  clocks: number = 0;
  tima: number = 0;
  tma: number = 0;
  tac: number = 0;
  // https://gbdev.io/pandocs/Timer_Obscure_Behaviour.html#timer-overflow-behaviour
  timaDelayed: boolean = false;

  constructor(interrupter: Interrupter) {
    this.interrupter = interrupter;
    this.reset();
  }

  reset() {
    this.clocks = 0xA7 * DIV_TICK_RATE;
    this.tima = 0;
    this.tma = 0;
    this.tac = 0;
    this.timaDelayed = false;
  }

  register(system: BaseSystem): void {
    const { ioBus } = system;
    ioBus.register(0x04, 'DIV', {
      read: () => (this.clocks / DIV_TICK_RATE) & 0xff,
      write: () => {
        this.clocks = 0;
        // Update the clock immediately
        if (this.tac & 0x4) {
          const oldBit = this.clocks & TIMA_TICK_BITS[this.tac & 0x3];
          if (oldBit) {
            this.tima += 1;
            this._postUpdateTIMA();
          }
        }
      },
    });
    ioBus.register(0x05, 'TIMA', {
      read: () => this.tima & 0xff,
      write: (_, value) => this.tima = value,
    });
    ioBus.register(0x06, 'TMA', {
      read: () => this.tma,
      write: (_, value) => this.tma = value,
    });
    ioBus.register(0x07, 'TAC', {
      read: () => this.tac,
      write: (_, value) => {
        const oldTAC = this.tac;
        this.tac = value;
        // Update the clock immediately
        // DMG bug - TAC increments even if enabled flag becomes false
        if (oldTAC & 0x4) {
          const oldBit = this.clocks & TIMA_TICK_BITS[oldTAC & 0x3];
          const newBit = this.clocks & TIMA_TICK_BITS[value & 0x3];
          if (!newBit && oldBit) {
            this.tima += 1;
            this._postUpdateTIMA();
          }
        }
      },
    });
  }

  serialize(): any {
    const output: any = {};
    SERIALIZE_FIELDS.forEach((key) => output[key] = this[key]);
    return output;
  }

  deserialize(data: any): void {
    SERIALIZE_FIELDS.forEach((key) => (this[key] as any) = data[key]);
  }

  getDebugState(): string {
    return [
      `DIV: ${this.read(0x4).toString(16).padStart(2, '0')} TIMA: ${this.read(0x5).toString(16).padStart(2, '0')} TMA: ${this.read(0x6).toString(16).padStart(2, '0')} TAC: ${this.read(7).toString(16).padStart(2, '0')}`,
    ].join('\n');
  }

  getNextWakeupClockAdvance(): number {
    if (this.tac & 0x4) {
      // Basically, we have to find nearest clock that triggers the timer
      // overflow interrupt.
      // This is the point where the TIMA becomes 0x100. We simply add the clock,
      // and round down to nearest bit
      const tickRate = TIMA_TICK_RATES[this.tac & 0x3];
      const curTime = this.clocks - (this.clocks % tickRate);
      const triggersNeeded = 0x100 - this.tima;
      return ((curTime + triggersNeeded * tickRate) - this.clocks) / 4 + 1;

    }
    return 0x7fffffff;
  }

  _postUpdateTIMA(): void {
    if (this.tima > 0xff) {
      this.timaDelayed = true;
      this.tima = 0x100;
    }
  }

  advanceClock(): void {
    if (this.timaDelayed) {
      this.timaDelayed = false;
      if (this.tima > 0xff) {
        this.tima = this.tma & 0xff;
        // Generate interrupt
        this.interrupter.queueInterrupt(INTERRUPT_TYPE.TIMER_OVERFLOW);
      }
    }
    if (this.tac & 0x4) {
      // Tick the clock according to the clock
      // Note that this needs to be in sync with "clocks" variable
      // (https://gbdev.io/pandocs/Timer_Obscure_Behaviour.html)
      // Since we don't get to emulate every cycle (this is doable though),
      // we simply derive the increment count from the number of triggers
      const nBits = TIMA_TICK_BITS[this.tac & 0x3];
      const oldBit = (this.clocks & nBits) !== 0;
      const newBit = ((this.clocks + 4) & nBits) !== 0;
      if (oldBit && !newBit) {
        this.tima += 1;
        this._postUpdateTIMA();
      }
    }
    this.clocks += 4;
  }

  read(pos: number): number {
    // FF00...FF0F
    switch (pos) {
      case 0x4:
        return (this.clocks / DIV_TICK_RATE) & 0xff;
      case 0x5:
        return this.tima & 0xff;
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
      case 0x4: {
        this.clocks = 0;
        // Update the clock immediately
        if (this.tac & 0x4) {
          const oldBit = this.clocks & TIMA_TICK_BITS[this.tac & 0x3];
          if (oldBit) {
            this.tima += 1;
            this._postUpdateTIMA();
          }
        }
        return;
      }
      case 0x5:
        this.tima = value;
        return;
      case 0x6:
        this.tma = value;
        return;
      case 0x7: {
        const oldTAC = this.tac;
        this.tac = value;
        // Update the clock immediately
        // DMG bug - TAC increments even if enabled flag becomes false
        if (oldTAC & 0x4) {
          const oldBit = this.clocks & TIMA_TICK_BITS[oldTAC & 0x3];
          const newBit = this.clocks & TIMA_TICK_BITS[value & 0x3];
          if (!newBit && oldBit) {
            this.tima += 1;
            this._postUpdateTIMA();
          }
        }
        return;
      }
    }
  }
}
