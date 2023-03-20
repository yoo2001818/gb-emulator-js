import { BaseSystem } from '../system/baseSystem';
import { BankedRAM } from './bankedRAM';

export class WRAM {
  bank: number;
  ram: BankedRAM;

  constructor() {
    this.bank = 1;
    this.ram = new BankedRAM(0x8000, () => false, (addr) => {
      if (addr < 0x1000) return 0;
      return this.bank * 0x1000;
    });
  }

  serialize(): any {
    return { ram: this.ram.serialize(), bank: this.bank };
  }

  deserialize(data: any): void {
    this.bank = data.bank;
    this.ram.deserialize(data.ram);
  }

  reset(): void {
    this.bank = 0;
    this.ram.reset();
  }

  register(system: BaseSystem): void {
    const { ioBus, memoryBus } = system;
    memoryBus.register(0xc0, 0xdf, this.ram);
    memoryBus.register(0xe0, 0xfd, this.ram);
    ioBus.register(0x70, 'SVBK', {
      read: () => this.bank,
      write: (_, value) => {
        this.bank = value & 0x7;
        if (this.bank === 0) {
          this.bank = 1;
        }
      },
    });
  }

}
