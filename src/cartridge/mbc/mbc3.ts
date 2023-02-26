import { CPU } from '../../cpu/cpu';
import { RTC } from '../rtc';
import { MemoryBankController } from './mbc';

export class MBC3 implements MemoryBankController {
  rom: Uint8Array;
  ram: Uint8Array | null;
  hasRTC: boolean;
  rtc: RTC;
  romBank: number = 1;
  ramBank: number = 0;
  ramEnabled: boolean = true;
  ramUpdated: boolean = false;

  constructor(rom: Uint8Array, ram: Uint8Array | null, cpu: CPU, hasRTC: boolean) {
    this.rom = rom;
    this.ram = ram;
    this.rtc = new RTC(cpu);
    this.hasRTC = hasRTC;
  }

  loadRAM(ram: Uint8Array): void {
    if (this.hasRTC) {
      this.ram = ram.slice(0, this.ram!.length);
      this.rtc.load(ram, this.ram!.length);
    } else {
      this.ram = ram;
    }
  }

  serializeRAM(): Uint8Array | null {
    if (this.hasRTC) {
      const saveData = new Uint8Array(this.ram!.length + 48);
      saveData.set(this.ram!, 0);
      this.rtc.save(saveData, this.ram!.length);
      return saveData;
    } else {
      return this.ram;
    }
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
