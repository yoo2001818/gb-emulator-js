import { RAM } from './ram';

export class LockableRAM extends RAM {
  isLocked: () => boolean;

  constructor(size: number = 0x2000, isLocked: () => boolean) {
    super(size);
    this.isLocked = isLocked;
  }

  read(pos: number): number {
    if (this.isLocked()) return 0xff;
    return super.read(pos);
  }

  write(pos: number, value: number): void {
    if (this.isLocked()) return;
    return super.write(pos, value);
  }
}

