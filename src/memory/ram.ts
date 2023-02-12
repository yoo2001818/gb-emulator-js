import { Memory } from './types';

export class RAM implements Memory {
  bytes: Uint8Array;
  size: number;
  constructor(size: number = 0x2000) {
    this.bytes = new Uint8Array(size);
    this.size = size;
  }

  read(pos: number): number {
    if (pos > this.size) {
      return 0xff;
    }
    return this.bytes[pos % this.size];
  }

  write(pos: number, value: number): void {
    this.bytes[pos % this.size] = value;
  }
}
