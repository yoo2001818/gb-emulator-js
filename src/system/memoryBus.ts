import { Memory } from '../memory/types';

const EMPTY_PORT: Memory = {
  read: () => 0xff,
  write: () => {},
};

export class MemoryBus implements Memory {
  // There are 256 ports here, for each 256 bytes. In other words, the port
  // number is determined shifting 8 bits right.
  ports: Memory[];
  offsets: number[];

  constructor() {
    this.ports = [];
    this.offsets = [];
    this.reset();
  }

  reset(): void {
    this.ports = Array.from({ length: 256 }, () => EMPTY_PORT);
    this.offsets = Array.from({ length: 256 }, () => 0);
  }

  register(from: number, to: number, port: Memory, offset?: number): void {
    for (let i = from; i <= to; i += 1) {
      this.ports[i] = port;
      this.offsets[i] = offset ?? (from << 8);
    }
  }

  read(addr: number): number {
    const id = addr >>> 8;
    const port = this.ports[id];
    if (port == null) return 0xff;
    return port.read(addr - this.offsets[id]);
  }

  write(addr: number, value: number): void {
    const id = addr >>> 8;
    const port = this.ports[id];
    if (port == null) return;
    port.write(addr - this.offsets[id], value);
  }
}
