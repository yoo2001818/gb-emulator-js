import { CPU } from '../cpu';
import { OpExec } from './types';
import { REGISTER } from '../constants';

export const jp_a16: OpExec = (cpu, pc) => {
  const nn1 = cpu.memory.read(pc + 1);
  cpu.tick(4);
  const nn2 = cpu.memory.read(pc + 2);
  cpu.tick(12);
  const nn = nn1 | (nn2 << 8);
  cpu.registers[REGISTER.PC] = nn;
};

export const jp_cond_a16 =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    if (cond(cpu)) {
      const nn1 = cpu.memory.read(pc + 1);
      cpu.tick(4);
      const nn2 = cpu.memory.read(pc + 2);
      cpu.tick(12);
      const nn = nn1 | (nn2 << 8);
      cpu.registers[REGISTER.PC] = nn;
    } else {
      cpu.skip(3);
      cpu.tick(12);
    }
  };

export const jp_hl: OpExec = (cpu, pc) => {
  const nn = cpu.readHL();
  cpu.registers[REGISTER.PC] = nn;
  cpu.tick(4);
};

export const jr_r8: OpExec = (cpu, pc) => {
  let n = cpu.memory.read(pc + 1);
  if (n & 0x80) {
    n = -((~n + 1) & 0xff);
  }
  cpu.registers[REGISTER.PC] = (cpu.registers[REGISTER.PC] + 2 + n) & 0xffff;
  cpu.tick(12);
};

export const jr_cond_r8 =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    if (cond(cpu)) {
      let n = cpu.memory.read(pc + 1);
      if (n & 0x80) {
        n = -((~n + 1) & 0xff);
      }
      cpu.registers[REGISTER.PC] = (cpu.registers[REGISTER.PC] + 2 + n) & 0xffff;
      cpu.tick(12);
    } else {
      cpu.skip(2);
      cpu.tick(8);
    }
  };

export const call_a16: OpExec = (cpu, pc) => {
  // read memory
  const nn1 = cpu.memory.read(pc + 1);
  cpu.tick(4);
  const nn2 = cpu.memory.read(pc + 2);
  cpu.tick(8);
  const nn = nn1 | (nn2 << 8);
  // push
  const value = pc + 3;
  const sp = cpu.registers[REGISTER.SP];
  cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
  cpu.tick(4);
  cpu.memory.write(sp - 2, value & 0xff);
  cpu.tick(8);
  cpu.registers[REGISTER.SP] = (cpu.registers[REGISTER.SP] - 2) & 0xffff;
  // finish jmp
  cpu.registers[REGISTER.PC] = nn;
};

export const call_cond_a16 =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    if (cond(cpu)) {
      // Read memory
      const nn1 = cpu.memory.read(pc + 1);
      cpu.tick(4);
      const nn2 = cpu.memory.read(pc + 2);
      cpu.tick(8);
      const nn = nn1 | (nn2 << 8);
      // push
      const value = pc + 3;
      const sp = cpu.registers[REGISTER.SP];
      cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
      cpu.tick(4);
      cpu.memory.write(sp - 2, value & 0xff);
      cpu.tick(8);
      cpu.registers[REGISTER.SP] = (cpu.registers[REGISTER.SP] - 2) & 0xffff;
      // jmp
      cpu.registers[REGISTER.PC] = nn;
    } else {
      cpu.skip(3);
      cpu.tick(12);
    }
  };

export const rst_nn =
  (n: number): OpExec =>
  (cpu, pc) => {
    cpu.tick(4);
    // push
    const value = pc + 1;
    const sp = cpu.registers[REGISTER.SP];
    cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
    cpu.tick(4);
    cpu.memory.write(sp - 2, value & 0xff);
    cpu.tick(8);
    cpu.registers[REGISTER.SP] = (cpu.registers[REGISTER.SP] - 2) & 0xffff;
    // jmp
    cpu.registers[REGISTER.PC] = n;
  };

export const ret: OpExec = (cpu, pc) => {
  // pop
  const sp = cpu.registers[REGISTER.SP];
  const value1 = cpu.memory.read(sp);
  cpu.tick(4);
  const value2 = cpu.memory.read(sp + 1);
  cpu.tick(12);
  const value = value1 | (value2 << 8);
  cpu.registers[REGISTER.SP] = (cpu.registers[REGISTER.SP] + 2) & 0xffff;
  // jmp
  cpu.registers[REGISTER.PC] = value;
};

export const ret_cond =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    if (cond(cpu)) {
      // pop
      const sp = cpu.registers[REGISTER.SP];
      cpu.tick(4);
      const value1 = cpu.memory.read(sp);
      cpu.tick(4);
      const value2 = cpu.memory.read(sp + 1);
      cpu.tick(12);
      const value = value1 | (value2 << 8);
      cpu.registers[REGISTER.SP] = (cpu.registers[REGISTER.SP] + 2) & 0xffff;
      // jmp
      cpu.registers[REGISTER.PC] = value;
    } else {
      cpu.skip(1);
      cpu.tick(8);
    }
  };

export const reti: OpExec = (cpu, pc) => {
  // pop
  const sp = cpu.registers[REGISTER.SP];
  const value1 = cpu.memory.read(sp);
  cpu.tick(4);
  const value2 = cpu.memory.read(sp + 1);
  cpu.tick(12);
  const value = value1 | (value2 << 8);
  cpu.registers[REGISTER.SP] = (cpu.registers[REGISTER.SP] + 2) & 0xffff;
  // jmp
  cpu.registers[REGISTER.PC] = value;
  // enable interrupts
  cpu.isInterruptsEnabledNext = true;
};
