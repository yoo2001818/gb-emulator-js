import { CPU } from '../cpu';
import { OpExec } from './types';
import { REGISTER } from '../constants';

export const jp_a16: OpExec = (cpu, pc) => {
  const nn = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  cpu.registers[REGISTER.PC] = nn;
};

export const jp_cond_a16 =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    if (cond(cpu)) {
      const nn = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
      cpu.registers[REGISTER.PC] = nn;
    } else {
      cpu.registers[REGISTER.PC] += 1;
    }
  };

export const jp_hl: OpExec = (cpu, pc) => {
  const nn = cpu.readHL();
  cpu.registers[REGISTER.PC] = nn;
};

export const jr_r8: OpExec = (cpu, pc) => {
  let n = cpu.memory.read(pc + 1);
  if (n & 0x80) {
    n = -((~n + 1) & 0xff);
  }
  cpu.registers[REGISTER.PC] += n;
};

export const jr_cond_r8 =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    if (cond(cpu)) {
      let n = cpu.memory.read(pc + 1);
      if (n & 0x80) {
        n = -((~n + 1) & 0xff);
      }
      cpu.registers[REGISTER.PC] += n;
    } else {
      cpu.registers[REGISTER.PC] += 2;
    }
  };

export const call_a16: OpExec = (cpu, pc) => {
  // push
  const value = pc + 3;
  const sp = cpu.registers[REGISTER.SP];
  cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
  cpu.memory.write(sp - 2, value & 0xff);
  cpu.registers[REGISTER.SP] -= 2;
  // jmp
  const nn = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  cpu.registers[REGISTER.PC] = nn;
};

export const call_cond_a16 =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    if (cond(cpu)) {
      // push
      const value = pc + 3;
      const sp = cpu.registers[REGISTER.SP];
      cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
      cpu.memory.write(sp - 2, value & 0xff);
      cpu.registers[REGISTER.SP] -= 2;
      // jmp
      const nn = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
      cpu.registers[REGISTER.PC] = nn;
    } else {
      cpu.registers[REGISTER.PC] += 3;
    }
  };

export const rst_nn =
  (n: number): OpExec =>
  (cpu, pc) => {
    // push
    const value = pc + 2;
    const sp = cpu.registers[REGISTER.SP];
    cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
    cpu.memory.write(sp - 2, value & 0xff);
    cpu.registers[REGISTER.SP] -= 2;
    // jmp
    cpu.registers[REGISTER.PC] = n;
  };

export const ret: OpExec = (cpu, pc) => {
  // pop
  const sp = cpu.registers[REGISTER.SP];
  const value = cpu.memory.read(sp) | (cpu.memory.read(sp + 1) << 8);
  cpu.registers[REGISTER.SP] += 2;
  // jmp
  cpu.registers[REGISTER.PC] = value;
};

export const ret_cond =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    if (cond(cpu)) {
      // pop
      const sp = cpu.registers[REGISTER.SP];
      const value = cpu.memory.read(sp) | (cpu.memory.read(sp + 1) << 8);
      cpu.registers[REGISTER.SP] += 2;
      // jmp
      cpu.registers[REGISTER.PC] = value;
    } else {
      cpu.registers[REGISTER.PC] += 1;
    }
  };

export const reti: OpExec = (cpu, pc) => {
  // pop
  const sp = cpu.registers[REGISTER.SP];
  const value = cpu.memory.read(sp) | (cpu.memory.read(sp + 1) << 8);
  cpu.registers[REGISTER.SP] += 2;
  // jmp
  cpu.registers[REGISTER.PC] = value;
  // enable interrupts
  cpu.isInterruptsEnabled = true;
  cpu.isInterruptsEnabledNext = true;
};
