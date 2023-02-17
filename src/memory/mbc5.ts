import { Memory } from './types';

export class MBC5 implements Memory {
  rom: Uint8Array;
  ram: Uint8Array;
  romBank: number = 1;
  ramBank: number = 0;
  ramEnabled: boolean = true;
  initialTime: number = Date.now();
  latchedTime: Date | null = null;

  constructor(rom: Uint8Array, ram: Uint8Array) {
    this.rom = rom;
    this.ram = ram;
  }

  getDebugState(): string {
    return [
      `ROM Bank: ${this.romBank} RAM Bank: ${this.ramBank}`,
    ].join('\n');
  }

  read(pos: number): number {
    // ROM Bank 00
    if (pos < 0x4000) return this.rom[pos];
    // ROM Bank 01..7F
    if (pos < 0x8000) {
      return this.rom[(this.romBank * 0x4000 + (pos - 0x4000)) % this.rom.length];
    }
    // N/A
    if (pos < 0xA000) return 0;
    // RAM Bank 00..03
    if (pos < 0xC000) {
      if (this.ramBank < 3) {
        return this.ram[(this.ramBank * 0x2000 + (pos - 0xA000)) % this.ram.length];
      } else {
        // RTC Access
        const date = this.latchedTime ?? new Date();
        const timeDiff = date.getTime() - this.initialTime;
        switch (this.ramBank) {
          case 0x8:
            return Math.floor(timeDiff / 1000) % 60;
          case 0x9:
            return Math.floor(timeDiff / 1000 / 60) % 60;
          case 0xA:
            return Math.floor(timeDiff / 1000 / 60 / 60) % 24;
          case 0xB: {
            const day = Math.floor(timeDiff / 1000 / 60 / 60 / 24);
            return day & 0xff;
          }
          case 0xC: {
            const day = Math.floor(timeDiff / 1000 / 60 / 60 / 24);
            const overflown = day > 0x100;
            let bits = 0;
            bits |= (day >> 8) & 1;
            if (this.latchedTime != null) bits |= 1 << 6;
            if (overflown) bits |= 1 << 7;
            return bits;
          }
        }
      }
    }
    return 0;
  }

  write(pos: number, value: number): void {
    // RAM and Timer Enable
    if (pos < 0x2000) {
      this.ramEnabled = (value & 0x0A) !== 0;
      return;
    }
    // ROM Bank Number (Low)
    if (pos < 0x3000) {
      this.romBank = (this.romBank & 0x100) | (value & 0xff);
      return;
    }
    // ROM Bank Number (High)
    if (pos < 0x4000) {
      this.romBank = ((value << 8) & 0x100) | (this.romBank & 0xff);
      return;
    }
    // RAM Bank Number
    if (pos < 0x6000) {
      this.ramBank = value & 0x0f;
      return;
    }
    // Latch Clock Data
    if (pos < 0x8000) {
      if (value) {
        this.latchedTime = new Date();
      } else {
        this.latchedTime = null;
      }
      return;
    }
    // Noop
    if (pos < 0xA000) return;
    // RAM Bank 00..03
    if (pos < 0xC000) {
      if (this.ramBank < 3) {
        this.ram[(this.ramBank * 0x2000 + (pos - 0xA000)) % this.ram.length] = value;
      } else {
        // RTC Access
        // FIXME: Implement this
      }
    }
  }
}

