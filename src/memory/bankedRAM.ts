import { Memory } from './types';
import { deserializeBytes, serializeBytes } from './utils';

export class BankedRAM implements Memory {
  bytes: Uint8Array;
  size: number;
  isLocked: () => boolean;
  getOffset: () => number;

  constructor(
    size: number = 0x2000,
    isLocked: () => boolean,
    getOffset: () => number,
  ) {
    this.bytes = new Uint8Array(size);
    this.size = size;
    this.getOffset = getOffset;
    this.isLocked = isLocked;
  }

  serialize(): any {
    return serializeBytes(this.bytes);
  }

  deserialize(data: any): void {
    deserializeBytes(data, this.bytes);
  }

  read(pos: number): number {
    if (this.isLocked()) return 0xff;
    if (pos > this.size) {
      return 0xff;
    }
    return this.bytes[(pos + this.getOffset()) % this.size];
  }

  write(pos: number, value: number): void {
    if (this.isLocked()) return;
    this.bytes[(pos + this.getOffset()) % this.size] = value;
  }

  reset(): void {
    this.bytes.fill(0);
  }
}

