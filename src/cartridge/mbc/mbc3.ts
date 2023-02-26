import { CPU } from '../../cpu/cpu';
import { RTC } from '../rtc';
import { MemoryBankController } from './mbc';

export class MBC3 implements MemoryBankController {
  rom: Uint8Array;
  ram: Uint8Array | null;
  rtc: RTC;
  romBank: number = 1;
  ramBank: number = 0;
  ramEnabled: boolean = true;
  ramUpdated: boolean = false;

  constructor(rom: Uint8Array, ram: Uint8Array | null, cpu: CPU) {
    this.rom = rom;
    this.ram = ram;
    this.rtc = new RTC(cpu);
  }

  loadRAM(ram: Uint8Array): void {
    this.ram = ram;
    // TODO: Load RTC
  }

  serializeRAM(): Uint8Array | null {
    // TODO: Save RTC
    return this.ram;
  }

  getDebugState(): string {
    return [
      `ROM Bank: ${this.romBank} RAM Bank: ${this.ramBank} RTC: ${this.rtc.selectedRegister}`,
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
      if (!this.ramEnabled) return 0xff;
      if (this.ramBank < 3) {
        if (this.ram == null) return 0xff;
        return this.ram[(this.ramBank * 0x2000 + (pos - 0xA000)) % this.ram.length];
      } else {
        return this.rtc.read(pos);
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
    // ROM Bank Number
    if (pos < 0x4000) {
      this.romBank = value & 0x7f;
      if (this.romBank === 0) {
        this.romBank = 1;
      }
      return;
    }
    // RAM Bank Number
    if (pos < 0x6000) {
      this.ramBank = value & 0x0f;
      this.rtc.write(pos, value);
      return;
    }
    // Latch Clock Data
    if (pos < 0x8000) {
      this.rtc.write(pos, value);
      return;
    }
    // Noop
    if (pos < 0xA000) return;
    // RAM Bank 00..03
    if (pos < 0xC000) {
      if (!this.ramEnabled) return;
      if (this.ramBank < 3) {
        if (this.ram == null) return;
        this.ram[(this.ramBank * 0x2000 + (pos - 0xA000)) % this.ram.length] = value;
        this.ramUpdated = true;
      } else {
        // RTC Access
        this.rtc.write(pos, value);
      }
    }
  }

  reset(): void {
    // NOTE: Don't reset SRAM
    this.romBank = 1;
    this.ramBank = 0;
  }
}
