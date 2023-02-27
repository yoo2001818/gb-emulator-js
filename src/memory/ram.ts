import { Memory } from './types';
import { deserializeBytes, serializeBytes } from './utils';

export class RAM implements Memory {
  bytes: Uint8Array;
  size: number;
  constructor(size: number = 0x2000) {
    this.bytes = new Uint8Array(size);
    this.size = size;
  }

  serialize(): any {
    return serializeBytes(this.bytes);
  }

  deserialize(data: any): void {
    deserializeBytes(data, this.bytes);
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

  reset(): void {
    this.bytes.fill(0);
  }
}
