import { Memory } from './types';
import { deserializeBytes, serializeBytes } from './utils';

export class BankedRAM implements Memory {
  bytes: Uint8Array;
  size: number;
  offset: number;
  isLocked: () => boolean;

  constructor(size: number = 0x2000, isLocked: () => boolean) {
    this.bytes = new Uint8Array(size);
    this.size = size;
    this.offset = 0;
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
    return this.bytes[(pos + this.offset) % this.size];
  }

  write(pos: number, value: number): void {
    if (this.isLocked()) return;
    this.bytes[(pos + this.offset) % this.size] = value;
  }

  reset(): void {
    this.bytes.fill(0);
  }
}

