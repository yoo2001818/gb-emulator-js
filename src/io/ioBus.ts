import { Memory } from '../memory/types';

interface IOPort {
  read(): number;
  write(value: number): number;
}

export class IOBus implements Memory {
  ports: (IOPort | null)[];

  constructor() {
    this.ports = Array.from({ length: 256 }, () => null);
  }

  reset() {
    this.ports = Array.from({ length: 256 }, () => null);
  }

  registerPort(pos: number, port: IOPort): void {
    this.ports[pos] = port;
  }

  read(pos: number): number {
    const port = this.ports[pos];
    if (port == null) return 0xff;
    return port.read();
  }

  write(pos: number, value: number): void {
    const port = this.ports[pos];
    if (port == null) return;
    port.write(value);
  }
}
