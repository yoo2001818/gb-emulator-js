import { BaseSystem } from './baseSystem';

export class DMA {
  src: number = 0;
  pos: number = -1;
  system: BaseSystem | null = null;

  serialize(): any {
    return { src: this.src, pos: this.pos };
  }

  deserialize(data: any): void {
    this.src = data.src;
    this.pos = data.pos;
  }

  reset(): void {
    this.src = 0;
    this.pos = -1;
  }

  register(system: BaseSystem): void {
    const { ioBus } = system;
    ioBus.register(0x46, 'DMA', {
      read: () => 0xff,
      write: (_, value) => {
        // Perform DMA operation
        const source = value << 8;
        this.src = source;
        this.pos = 0;
        // TODO: Lock memory
      },
    });
    this.system = system;
  }

  advanceClock(): void {
    if (this.system == null) return;
    if (this.pos >= 0) {
      const memory = this.system.memoryBus;
      const value = memory.read(this.src + this.pos);
      memory.write(0xfe00 + this.pos, value);
      this.pos += 1;
      if (this.pos >= 160) {
        this.pos = -1;
        // TODO: Unlock memory
      }
    }
  }
}
