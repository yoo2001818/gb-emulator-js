import { Memory } from "../memory/types";

export class RTC implements Memory {
  constructor() {
    // TODO: Stub
  }

  read(pos: number): number {
    return 0xff;
  }

  write(pos: number, value: number): void {
  }
}
