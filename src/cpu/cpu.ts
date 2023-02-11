import { Memory } from '../memory/types';
import { FLAG, REGISTER } from './constants';
import { main_opcodes } from './ops/opcode';

export class CPU {
  registers: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  clocks: number = 0;
  memory: Memory;
  isRunning = false;
  isInterruptsEnabled = false;
  isInterruptsEnabledNext = false;

  constructor(memory: Memory) {
    this.memory = memory;
    this.reset();
  }

  reset(): void {
    this.registers = [0x01, 0, 0x13, 0, 0xd8, 0xb0, 0x01, 0x4d, 0, 0, 0, 0, 0, 0xfffe];
    this.clocks = 0;
  }

  readHL(): number {
    return (this.registers[REGISTER.H] << 8) | this.registers[REGISTER.L];
  }

  writeHL(value: number): void {
    this.registers[REGISTER.H] = (value >>> 8) & 0xff;
    this.registers[REGISTER.L] = value & 0xff;
  }

  getFlag(flag: number): boolean {
    return (this.registers[REGISTER.F] & (1 << flag)) !== 0;
  }

  aluSetFlags(z: boolean, n: boolean, h: boolean, c: boolean): void {
    let flags = 0;
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
    this.registers[REGISTER.SP] = (this.registers[REGISTER.SP] - 2) & 0xffff;
    this.clocks += 8;
  }

  getDebugState(): string {
    return [
      `PC: ${this.registers[REGISTER.PC].toString(16)} SP: ${this.registers[REGISTER.SP].toString(16)}`,
      `A: ${this.registers[REGISTER.A].toString(16)} BC: ${((this.registers[REGISTER.B] << 8) | this.registers[REGISTER.C]).toString(16)}`,
      `DE: ${((this.registers[REGISTER.D] << 8) | this.registers[REGISTER.E]).toString(16)} HL: ${((this.registers[REGISTER.H] << 8) | this.registers[REGISTER.L]).toString(16)}`,
      `Z: ${this.getFlag(FLAG.Z)} N: ${this.getFlag(FLAG.N)} H: ${this.getFlag(FLAG.H)} C: ${this.getFlag(FLAG.C)}`,
    ].join('\n');
  }

  step(): void {
    const pc = this.registers[REGISTER.PC];
    const opcode = this.memory.read(pc);
    const op_exec = main_opcodes[opcode];
    // console.log(op_exec);
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
