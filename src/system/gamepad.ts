import { BaseSystem } from "./baseSystem";
import { INTERRUPT_TYPE } from "./interrupter";

export const BUTTON = {
  RIGHT: 0,
  LEFT: 1,
  UP: 2,
  DOWN: 3,
  A: 4,
  B: 5,
  SELECT: 6,
  START: 7,
};

export class GamepadController {
  selectedNibbleHigh: boolean = false;
  buttons!: boolean[];
  system: BaseSystem | null = null;
  constructor() {
    this.reset();
  }
  reset() {
    this.selectedNibbleHigh = false;
    this.buttons = [false, false, false, false, false, false, false, false];
  }
  register(system: BaseSystem): void {
    this.system = system;
    const { ioBus } = system;
    ioBus.register(0x00, 'JOYP', {
      read: () => {
        let output = 0;
        const offset = this.selectedNibbleHigh ? 4 : 0;
        if (!this.buttons[offset + 0]) output |= 0x1;
        if (!this.buttons[offset + 1]) output |= 0x2;
        if (!this.buttons[offset + 2]) output |= 0x4;
        if (!this.buttons[offset + 3]) output |= 0x8;
        return output;
      },
      write: (_, value) => {
        if ((value & 0x20) === 0) {
          this.selectedNibbleHigh = true;
        } else if ((value & 0x10) === 0) {
          this.selectedNibbleHigh = false;
        }
      },
    });
  }
  set(index: number, value: boolean): void {
    // TODO: Button Interrupts
    if (this.system != null) {
      this.system.interrupter.queueInterrupt(INTERRUPT_TYPE.PIN_TRIGGERED);
    }
    this.buttons[index] = value;
  }
}
