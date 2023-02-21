import { MemoryBankController } from './mbc';

export class MBC1 implements MemoryBankController {
  rom: Uint8Array;
  ram: Uint8Array | null;
  bank: number = 1;
  ramEnabled: boolean = true;
  ramUpdated: boolean = false;
  bankingMode: boolean = false;

  constructor(rom: Uint8Array, ram?: Uint8Array) {
    this.rom = rom;
    this.ram = ram ?? null;
  }

  loadRAM(ram: Uint8Array): void {
    this.ram = ram;
  }

  serializeRAM(): Uint8Array | null {
    return this.ram;
  }

  getDebugState(): string {
    return [
      `Bank: ${this.bank.toString(16).padStart(2, '0')} Mode: ${this.bankingMode}`,
    ].join('\n');
  }

  read(pos: number): number {
    // ROM Bank 00
    if (pos < 0x4000) {
      const highBank = this.bankingMode ? (this.bank & 0x60) : 0;
      return this.rom[(highBank * 0x4000 + pos) % this.rom.length];
    }
    // ROM Bank 01..7F
    if (pos < 0x8000) {
      return this.rom[(this.bank * 0x4000 + (pos - 0x4000)) % this.rom.length];
    }
    // N/A
    if (pos < 0xA000) return 0;
    // RAM Bank 00..03
    if (pos < 0xC000) {
      if (this.ram == null) return 0xff;
      const highBank = this.bankingMode ? ((this.bank >> 4) & 0x3) : 0;
      return this.ram[(highBank * 0x2000 + (pos - 0xA000)) % this.ram.length];
    }
    return 0;
  }

  write(pos: number, value: number): void {
    // RAM Enable
    if (pos < 0x2000) {
      this.ramEnabled = (value & 0x0A) !== 0;
      return;
    }
    // ROM Bank Number
    if (pos < 0x4000) {
      this.bank = (this.bank & ~0x1f) | (value & 0x1f);
      if (this.bank === 0) {
        this.bank = 1;
      }
      return;
    }
    // RAM Bank Number, or Upper Bits of ROM Bank Number
    if (pos < 0x6000) {
      this.bank = (this.bank & ~0x60) | ((value << 4) & 0x60);
      return;
    }
    // Banking Mode Select
    if (pos < 0x8000) {
      this.bankingMode = value !== 0;
      return;
    }
    // Noop
    if (pos < 0xA000) return;
    // RAM Bank 00..03
    if (pos < 0xC000) {
      if (this.ram == null) return;
      const highBank = this.bankingMode ? ((this.bank >> 4) & 0x3) : 0;
      this.ram[(highBank * 0x2000 + (pos - 0xA000)) % this.ram.length] = value;
      this.ramUpdated = true;
    }
  }

  reset(): void {
    // NOTE: Don't reset SRAM
    this.bank = 1;
    this.bankingMode = false;
  }
}
