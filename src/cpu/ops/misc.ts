import { OpExec } from './types';
import { FLAG, REGISTER } from '../constants';
import { Register16Description } from './register';

export const nop: OpExec = (cpu) => {
  cpu.skip(1);
};

export const push =
  (r: Register16Description): OpExec =>
  (cpu) => {
    const value = r.read(cpu);
    const sp = cpu.registers[REGISTER.SP];
    cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
    cpu.memory.write(sp - 2, value & 0xff);
    cpu.registers[REGISTER.SP] -= 2;
    cpu.skip(1);
    r.postCallback(cpu);
  };

export const pop =
  (r: Register16Description): OpExec =>
  (cpu) => {
    const sp = cpu.registers[REGISTER.SP];
    const value = cpu.memory.read(sp) | (cpu.memory.read(sp + 1) << 8);
    r.write(cpu, value);
    cpu.registers[REGISTER.SP] += 2;
    cpu.skip(1);
    r.postCallback(cpu);
  };

export const add16 =
  (r1: Register16Description, r2: Register16Description): OpExec =>
  (cpu, pc) => {
    const n1 = r1.read(cpu);
    const n2 = r2.read(cpu);
    const result = n1 + n2;
    cpu.aluSetFlags(
      cpu.getFlag(FLAG.Z),
      false,
      (result & 0x1000) !== 0,
      (result & 0x10000) !== 0
    );
    r1.write(cpu, result & 0xffff);
    cpu.skip(1);
    r1.postCallback(cpu);
    r2.postCallback(cpu);
  };

export const add16_sp_n: OpExec = (cpu, pc) => {
  const n1 = cpu.registers[REGISTER.SP];
  const n2 = cpu.memory.read(pc + 1);
  const result = n1 + n2;
  cpu.registers[REGISTER.SP] = result & 0xffff;
  cpu.skip(2);
};

export const inc16 =
  (r: Register16Description): OpExec =>
  (cpu) => {
    const n1 = r.read(cpu);
    const result = n1 + 1;
    r.write(cpu, result & 0xffff);
    cpu.skip(1);
    r.postCallback(cpu);
  };

export const dec16 =
  (r: Register16Description): OpExec =>
  (cpu) => {
    const n1 = r.read(cpu);
    const result = n1 - 1;
    r.write(cpu, result & 0xffff);
    cpu.skip(1);
    r.postCallback(cpu);
  };

export const daa: OpExec = (cpu) => {
  let value = cpu.registers[REGISTER.A];
  if (cpu.getFlag(FLAG.H) || (value & 0x0f) > 9) {
    value += 0x06;
  }
  let carry = false;
  if (cpu.getFlag(FLAG.C) || (value & 0xf0) > 9) {
    carry = true;
    value += 0x60;
  }
  cpu.aluSetFlags((value & 0xff) === 0, cpu.getFlag(FLAG.N), false, carry);
  cpu.registers[REGISTER.A] = value & 0xff;
  cpu.skip(1);
};

export const cpl: OpExec = (cpu) => {
  const result = ~cpu.registers[REGISTER.A] & 0xff;
  cpu.aluSetFlags(cpu.getFlag(FLAG.Z), false, false, cpu.getFlag(FLAG.C));
  cpu.registers[REGISTER.A] = result;
  cpu.skip(1);
};

export const ccf: OpExec = (cpu) => {
  cpu.aluSetFlags(cpu.getFlag(FLAG.Z), false, false, !cpu.getFlag(FLAG.C));
  cpu.skip(1);
};

export const scf: OpExec = (cpu) => {
  cpu.aluSetFlags(cpu.getFlag(FLAG.Z), false, false, true);
  cpu.skip(1);
};

export const halt: OpExec = (cpu) => {
  cpu.isRunning = false;
  cpu.skip(1);
};

export const stop: OpExec = (cpu) => {
  // TODO: Wait for button press
  cpu.isRunning = false;
  cpu.skip(2);
};

export const di: OpExec = (cpu) => {
  cpu.isInterruptsEnabledNext = false;
  cpu.skip(1);
};

export const ei: OpExec = (cpu) => {
  cpu.isInterruptsEnabledNext = true;
  cpu.skip(1);
};
