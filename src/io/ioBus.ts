import { Memory } from '../memory/types';

const EMPTY_PORT: Memory = {
  read: () => 0xff,
  write: () => {},
};

export class IOBus implements Memory {
  ports: Memory[];
  names: (string | null)[];
  offsets: number[];

  constructor() {
    this.ports = [];
    this.names = [];
    this.offsets = [];
    this.reset();
  }

  reset(): void {
    this.ports = Array.from({ length: 256 }, () => EMPTY_PORT);
    this.names = Array.from({ length: 256 }, () => null);
    this.offsets = Array.from({ length: 256 }, () => 0);
  }

  register(pos: number, name: string, port: Memory): void {
    this.ports[pos] = port;
    this.names[pos] = name;
    this.offsets[pos] = 0;
  }

  registerMemory(pos: number, size: number, name: string, mem: Memory): void {
    for (let i = 0; i < size; i += 1) {
      this.ports[pos + i] = mem;
      this.names[pos + i] = name;
      this.offsets[pos + i] = pos;
    }
  }

  read(pos: number): number {
    const port = this.ports[pos];
    if (port == null) return 0xff;
    const offset = this.offsets[pos];
    return port.read(pos - offset);
  }

  write(pos: number, value: number): void {
    const port = this.ports[pos];
    if (port == null) return;
    const offset = this.offsets[pos];
    port.write(pos - offset, value);
  }
}
