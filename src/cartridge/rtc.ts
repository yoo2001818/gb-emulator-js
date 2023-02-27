import { CPU } from "../cpu/cpu";
import { Memory } from "../memory/types";
import { loadRTC, saveRTC } from "./rtcSave";

export interface RTCData {
  seconds: number;
  minutes: number;
  hours: number;
  days: number;
  halted: boolean;
}

export class RTC implements Memory {
  cpu: CPU;
  selectedRegister: number;
  // Note that this does not use unix timestamp; instead, we link them with
  // CPU cycles...
  data: RTCData;
  latchedData: RTCData | null;
  prevClocks: number;

  constructor(cpu: CPU) {
    this.cpu = cpu;
    this.selectedRegister = 0;
    this.data = { seconds: 0, minutes: 0, hours: 0, days: 0, halted: false };
    this.latchedData = null;
    this.prevClocks = 0;
  }

  load(input: Uint8Array, offset: number): void {
    this.prevClocks = 0;
    this.data = loadRTC(input, offset);
    this.latchedData = null;
  }

  save(output: Uint8Array, offset: number): void {
    saveRTC(this.data, output, offset);
  }

  serialize(): any {
    const output: any = {};
    output.selectedRegister = this.selectedRegister;
    output.data = { ...this.data };
    output.latchedData = this.latchedData;
    output.prevClocks = this.prevClocks;
    return output;
  }

  deserialize(data: any): void {
    this.selectedRegister = data.selectedRegister;
    this.data = { ...data.data };
    this.latchedData = data.latchedData ?? null;
    this.prevClocks = data.prevClocks;
  }

  reset(): void {
    this.prevClocks = 0;
  }

  _updateRTC(): void {
    const clocks = this.cpu.clocks;
    if (this.data.halted) {
      this.prevClocks = clocks;
      return;
    }
    const diff = clocks - this.prevClocks;
    // Only increment the clock when the clocks are more than 1MHz
    const addSeconds = Math.floor(diff / 1048576);
    if (addSeconds > 0) {
      const newSeconds = Math.min(this.data.seconds, 59) + addSeconds;
      const newMinutes = Math.min(this.data.minutes, 59) + Math.floor(newSeconds / 60);
      const newHours = Math.min(this.data.hours, 23) + Math.floor(newMinutes / 60);
      const newDays = this.data.days + Math.floor(newHours / 24);
      this.data.seconds = newSeconds % 60;
      this.data.minutes = newMinutes % 60;
      this.data.hours = newHours % 24;
      this.data.days = newDays;
      this.prevClocks += addSeconds * 1048576;
    }
  }

  read(pos: number): number {
    if (pos >= 0xa000 && pos < 0xc000) {
      // RTC read request
      this._updateRTC();
      const data = this.latchedData ?? this.data;
      switch (this.selectedRegister) {
        case 0x8:
          return data.seconds;
        case 0x9:
          return data.minutes;
        case 0xa:
          return data.hours;
        case 0xb:
          return data.days & 0xff;
        case 0xc: {
          let output = (data.days >>> 8) & 1;
          if (data.halted) output |= 0x40;
          if (data.days >= 0x200) output |= 0x80;
          return output;
        }
        default:
          return 0xff;
      }
    }
    return 0xff;
  }

  write(pos: number, value: number): void {
    if (pos >= 0x4000 && pos < 0x6000) {
      // RTC register select
      this.selectedRegister = value;
    } else if (pos >= 0xa000 && pos < 0xc000) {
      // RTC write request
      this._updateRTC();
      switch (this.selectedRegister) {
        case 0x8:
          this.data.seconds = value;
          break;
        case 0x9:
          this.data.minutes = value;
          break;
        case 0xa:
          this.data.hours = value;
          break;
        case 0xb:
          this.data.days = (this.data.days & ~0xff) | (value & 0xff);
          break;
        case 0xc: {
          this.data.days = (this.data.days & ~0x100) | ((value & 1) << 8);
          this.data.halted = (value & 0x40) !== 0;
          if ((value & 0x80) !== 0) {
            this.data.days = this.data.days & 0x1ff;
          }
          break;
        }
      }
    } else if (pos >= 0x6000 && pos < 0x8000) {
      // Latch clock data
      if (value === 1) {
        this._updateRTC();
        if (this.latchedData != null) {
          this.latchedData = null;
        } else {
          this.latchedData = { ...this.data };
        }
      }
    }
  }
}
