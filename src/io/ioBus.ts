import { Memory } from '../memory/types';

const EMPTY_PORT: Memory = {
  read: () => 0xff,
  write: () => {},
};

export class IOBus implements Memory {
  ports: Memory[];
  names: (string | null)[];

  constructor() {
    this.ports = [];
    this.names = [];
    this.reset();
  }

  reset(): void {
    this.ports = Array.from({ length: 256 }, () => EMPTY_PORT);
    this.names = Array.from({ length: 256 }, () => null);
  }

  register(pos: number, name: string, port: Memory): void {
    this.ports[pos] = port;
    this.names[pos] = name;
  }

  read(pos: number): number {
    const port = this.ports[pos];
    if (port == null) return 0xff;
    return port.read(pos);
  }

  write(pos: number, value: number): void {
    const port = this.ports[pos];
    if (port == null) return;
    port.write(pos, value);
  }
}
