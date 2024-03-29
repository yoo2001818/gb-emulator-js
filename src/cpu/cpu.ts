import { Memory } from '../memory/types';
import { FLAG, REGISTER } from './constants';
import { CPULog } from './log';
import { main_opcodes } from './ops/opcode';

export class CPU {
  registers: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  clocks: number = 0;
  memory: Memory;
  onTick: (clocks: number) => void;
  isRunning = false;
  isStopped = false;
  isBlocked = false;
  isInterruptsEnabled = false;
  isInterruptsEnabledNext = false;

  isTrapped = false;
  isTrapResolved = false;

  isDebugging = false;
  debugLogs: CPULog[] = [];
  opSizes: Uint8Array = new Uint8Array(0x10000);
  isBreakpointsEnabled = false;
  breakpoints: number[] = [];
  readBreakpoints: number[] = [];
  writeBreakpoints: number[] = [];

  constructor(memory: Memory) {
    this.memory = memory;
    this.reset([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    this.onTick = () => {};
  }

  reset(registers: number[]): void {
    this.registers = registers.slice();
    this.clocks = 0;
    this.isStopped = false;
    this.isBlocked = false;
    this.isInterruptsEnabled = false;
    this.isInterruptsEnabledNext = false;
    this.isDebugging = false;
    this.debugLogs = [];
    this.opSizes.fill(0);
  }

  resume(): void {
    this.isStopped = false;
    this.isRunning = true;
  }

  serialize(): any {
    const output: any = {};
    output.registers = [...this.registers];
    output.clocks = this.clocks;
    output.isRunning = this.isRunning;
    output.isInterruptsEnabled = this.isInterruptsEnabled;
    output.isInterruptsEnabledNext = this.isInterruptsEnabledNext;
    return output;
  }

  deserialize(data: any): void {
    this.registers = [...data.registers];
    this.clocks = data.clocks;
    this.isRunning = data.isRunning;
    this.isInterruptsEnabled = data.isInterruptsEnabled;
    this.isInterruptsEnabledNext = data.isInterruptsEnabledNext;
  }

  getDebugFlags(): string {
    let output = [];
    output.push(this.getFlag(FLAG.Z) ? 'Z' : '-');
    output.push(this.getFlag(FLAG.N) ? 'N' : '-');
    output.push(this.getFlag(FLAG.H) ? 'H' : '-');
    output.push(this.getFlag(FLAG.C) ? 'C' : '-');
    return output.join('');
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
    this.opSizes[pc] = bytes;
    this.registers[REGISTER.PC] = (pc + bytes) & 0xffff;
  }

  jump(addr: number): void {
    this.registers[REGISTER.PC] = addr & 0xffff;
  }

  tick(clocks: number): void {
    this.clocks += clocks;
    this.onTick(clocks);
  }

  log(
    type: CPULog['type'],
    data: string,
    address?: number,
    comment?: string
  ): void {
    this.debugLogs.push({ type, data, address, comment });
    if (this.debugLogs.length > 1000) {
      this.debugLogs.shift();
    }
  }

  trap(): void {
    this.isTrapped = true;
  }

  enterInterrupt(): void {
    // Reset IME Flag
    this.isInterruptsEnabled = false;
    this.isInterruptsEnabledNext = false;
    // Push PC
    const value = this.registers[REGISTER.PC];
    const sp = this.registers[REGISTER.SP];
    this.memory.write(sp - 1, (value >>> 8) & 0xff);
    this.memory.write(sp - 2, value & 0xff);
    this.registers[REGISTER.SP] = (this.registers[REGISTER.SP] - 2) & 0xffff;
    this.tick(5);
  }

  getDebugState(): string {
    return [
      `PC: ${this.registers[REGISTER.PC]
        .toString(16)
        .padStart(4, '0')} SP: ${this.registers[REGISTER.SP]
        .toString(16)
        .padStart(4, '0')}`,
      `A: ${this.registers[REGISTER.A].toString(16).padStart(4, '0')} BC: ${(
        (this.registers[REGISTER.B] << 8) |
        this.registers[REGISTER.C]
      )
        .toString(16)
        .padStart(4, '0')}`,
      `DE: ${((this.registers[REGISTER.D] << 8) | this.registers[REGISTER.E])
        .toString(16)
        .padStart(4, '0')} HL: ${(
        (this.registers[REGISTER.H] << 8) |
        this.registers[REGISTER.L]
      )
        .toString(16)
        .padStart(4, '0')}`,
      `Z: ${this.getFlag(FLAG.Z)} N: ${this.getFlag(FLAG.N)} H: ${this.getFlag(
        FLAG.H
      )} C: ${this.getFlag(FLAG.C)}`,
    ].join('\n');
  }

  step(): void {
    if (this.isBlocked) {
      // Do nothing and pass the time
      this.tick(1);
      return;
    }
    this.isInterruptsEnabled = this.isInterruptsEnabledNext;
    const pc = this.registers[REGISTER.PC];
    if (
      !this.isTrapResolved &&
      this.isBreakpointsEnabled &&
      this.breakpoints.includes(pc)
    ) {
      this.isTrapped = true;
      this.isDebugging = true;
      return;
    }
    this.isTrapResolved = false;
    const opcode = this.memory.read(pc);
    const op_exec = main_opcodes[opcode];
    if (op_exec != null) {
      op_exec(this, pc);
    } else {
      // Illegal instruction
      // (We skip it through)
      this.skip(1);
      this.tick(1);
    }
  }

  runUntilHalt(): void {
    this.isRunning = true;
    while (this.isRunning) {
      this.step();
    }
  }
}
