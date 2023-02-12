import { Memory } from "../memory/types";

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

export class GamepadController implements Memory {
  selectedNibbleHigh: boolean = false;
  buttons!: boolean[];
  constructor() {
    this.reset();
  }
  reset() {
    this.selectedNibbleHigh = false;
    this.buttons = [false, false, false, false, false, false, false, false];
  }
  set(index: number, value: boolean): void {
    // TODO: Button Interrupts
    this.buttons[index] = value;
  }
  read(pos: number): number {
    switch (pos) {
      case 0: {
        let output = 0;
        const offset = this.selectedNibbleHigh ? 0 : 4;
        if (!this.buttons[offset + 0]) output |= 0x1;
        if (!this.buttons[offset + 1]) output |= 0x2;
        if (!this.buttons[offset + 2]) output |= 0x4;
        if (!this.buttons[offset + 3]) output |= 0x8;
        return output;
      }
      default:
        return 0xff;
    }
  }
  write(pos: number, value: number): void {
    switch (pos) {
      case 0:
        if (value & 0x20) {
          this.selectedNibbleHigh = true;
        } else if (value & 0x10) {
          this.selectedNibbleHigh = false;
        }
        break;
    }
  }
}
