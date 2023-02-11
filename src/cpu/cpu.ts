import { Memory } from '../memory/types';
import { FLAG, REGISTER } from './constants';
import { main_opcodes } from './ops/opcode';

export class CPU {
  registers: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  memory: Memory;
  isRunning = false;
  isInterruptsEnabled = false;
  isInterruptsEnabledNext = false;

  constructor(memory: Memory) {
    this.memory = memory;
  }

  readHL(): number {
    return (this.registers[REGISTER.H] << 8) | this.registers[REGISTER.L];
  }

  writeHL(value: number): void {
    this.registers[REGISTER.H] = (value >>> 8) & 0xff;
    this.registers[REGISTER.L] = value & 0xff;
  }

  getFlag(flag: number): boolean {
    return this.registers[REGISTER.F] << flag !== 0;
  }

  aluSetFlags(z: boolean, n: boolean, h: boolean, c: boolean): void {
    let flags = this.registers[REGISTER.F] & 0xac;
    if (z) flags |= 1 << FLAG.Z;
    if (n) flags |= 1 << FLAG.N;
    if (h) flags |= 1 << FLAG.H;
    if (c) flags |= 1 << FLAG.C;
    this.registers[REGISTER.F] = flags;
  }

  skip(bytes: number): void {
    const pc = this.registers[REGISTER.PC];
    this.registers[REGISTER.PC] = (pc + bytes) & 0xffff;
  }

  jump(addr: number): void {
    this.registers[REGISTER.PC] = addr & 0xffff;
  }

  enterInterrupt(): void {
    // Reset IME Flag
    this.isInterruptsEnabled = false;
    this.isInterruptsEnabledNext = false;
    // Push PC
    const value = this.registers[REGISTER.PC] + 3;
    const sp = this.registers[REGISTER.SP];
    this.memory.write(sp - 1, (value >>> 8) & 0xff);
    this.memory.write(sp - 2, value & 0xff);
    this.registers[REGISTER.SP] -= 2;
  }

  step(): void {
    const pc = this.registers[REGISTER.PC];
    const opcode = this.memory.read(pc);
    const op_exec = main_opcodes[opcode];
    if (op_exec != null) {
      op_exec(this, pc);
    } else {
      // Illegal instruction
      // (We skip it through)
      this.skip(1);
    }
    // Clear interrupts
    this.isInterruptsEnabled = this.isInterruptsEnabledNext;
  }

  runUntilHalt(): void {
    this.isRunning = true;
    while (this.isRunning) {
      this.step();
    }
  }
}
