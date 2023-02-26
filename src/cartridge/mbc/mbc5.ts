import { MemoryBankController } from './mbc';

export class MBC5 implements MemoryBankController {
  rom: Uint8Array;
  ram: Uint8Array | null;
  romBank: number = 1;
  ramBank: number = 0;
  ramEnabled: boolean = true;
  initialTime: number = Date.now();
  latchedTime: Date | null = null;
  ramUpdated: boolean = false;

  constructor(rom: Uint8Array, ram: Uint8Array | null) {
    this.rom = rom;
    this.ram = ram;
  }

  loadRAM(ram: Uint8Array): void {
    this.ram = ram;
  }

  serializeRAM(): Uint8Array | null {
    return this.ram;
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
      if (this.ram == null) return 0xff;
      return this.ram[(this.ramBank * 0x2000 + (pos - 0xA000)) % this.ram.length];
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
    // Noop
    if (pos < 0xA000) return;
    // RAM Bank 00..03
    if (pos < 0xC000) {
      if (this.ram == null) return;
      this.ram[(this.ramBank * 0x2000 + (pos - 0xA000)) % this.ram.length] = value;
      this.ramUpdated = true;
    }
  }

  reset(): void {
    // NOTE: Don't reset SRAM
    this.romBank = 1;
    this.ramBank = 0;
  }
}

