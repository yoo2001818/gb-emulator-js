import { CPU } from "../cpu/cpu";
import { RAM } from "./ram";
import { Memory } from "./types";

export class MemoryBus implements Memory {
  cartridge: Memory;
  mainRAM: Memory;
  videoRAM: Memory;
  spriteOAM: Memory;
  endRAM: Memory;
  ioPorts: Memory;
  nullPort: Memory;
  lcd: Memory;
  timer: Memory;
  gamepad: Memory;

  // FIXME: This is only for debugging
  cpu!: CPU;

  constructor(cartridge: Memory, lcd: Memory, timer: Memory, gamepad: Memory) {
    this.cartridge = cartridge;
    this.mainRAM = new RAM(0x2000);
    this.videoRAM = new RAM(0x2000);
    this.spriteOAM = new RAM(0x100);
    this.endRAM = new RAM(0x80);
    this.ioPorts = new RAM(0x100);
    this.nullPort = {
      read: () => 0xff,
      write: () => {},
    };
    this.lcd = lcd;
    this.timer = timer;
    this.gamepad = gamepad;
  }

  getTarget(pos: number): [Memory, number] {
    // 0000 ... 8000 Cartridge
    if (pos < 0x8000) return [this.cartridge, pos];
    // 8000 ... a000 Video RAM
    if (pos < 0xa000) return [this.videoRAM, pos - 0x8000];
    // a000 ... c000 Cartridge SRAM Bank
    if (pos < 0xc000) return [this.cartridge, pos];
    // c000 ... e000 Internal RAM
    if (pos < 0xe000) return [this.mainRAM, pos - 0xc000];
    // e000 ... fe00 Echo of Internal RAM
    if (pos < 0xfe00) return [this.mainRAM, pos - 0xe000];
    // fe00 ... ff00 OAM
    if (pos < 0xff00) return [this.spriteOAM, pos - 0xfe00];
    // ff00 ... ff00 Gamepad
    if (pos === 0xff00) return [this.gamepad, pos - 0xff00];
    // ff01 ... ff04 General I/O
    if (pos < 0xff03) return [this.ioPorts, pos - 0xff00];
    if (pos < 0xff04) return [this.nullPort, pos - 0xff00];
    // ff04 ... ff0f Timer
    if (pos < 0xff0f) return [this.timer, pos - 0xff00];
    // ff0f ... ff0f IF
    if (pos === 0xff0f) return [this.ioPorts, pos - 0xff00];
    // ff10 ... ff40 Audio I/O
    if (pos < 0xff40) return [this.ioPorts, pos - 0xff00];
    // ff40 ... ff50 LCD I/O
    if (pos < 0xff50) return [this.lcd, pos - 0xff40];
    // ff50 ... ff80 Empty 
    if (pos < 0xff80) return [this.ioPorts, pos - 0xff00];
    // ff80 ... ffff Internal RAM
    return [this.endRAM, pos - 0xff80];
  }

  read(pos: number): number {
    const [target, nextPos] = this.getTarget(pos);
    return target.read(nextPos);
  }

  write(pos: number, value: number): void {
    const [target, nextPos] = this.getTarget(pos);
    return target.write(nextPos, value);
  }
}