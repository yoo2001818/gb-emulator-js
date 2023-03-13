import { Memory } from '../memory/types';

const EMPTY_PORT: Memory = {
  read: () => 0xff,
  write: () => {},
};

export class MemoryBus2 implements Memory {
  // There are 256 ports here, for each 256 bytes. In other words, the port
  // number is determined shifting 8 bits right.
  ports: Memory[];

  constructor() {
    this.ports = Array.from({ length: 256 }, () => EMPTY_PORT);
  }

  register(from: number, to: number, port: Memory): void {
    for (let i = from; i <= to; i += 1) {
      this.ports[i] = port;
    }
  }

  read(addr: number): number {
    const id = addr >>> 8;
    const port = this.ports[id];
    if (port == null) return 0xff;
    return port.read(addr);
  }

  write(addr: number, value: number): void {
    const id = addr >>> 8;
    const port = this.ports[id];
    if (port == null) return;
    port.write(addr, value);
  }
}
