import { OpExec } from './types';
import { REGISTER } from '../constants';
import { Register16Description, Register8Description } from './register';

export const ld =
  (r1: Register8Description, r2: Register8Description): OpExec =>
  (cpu) => {
    const value = r2.read(cpu);
    r1.write(cpu, value);
    cpu.skip(1);
    cpu.clocks += r1.clocks + r2.clocks + 4;
  };

export const ld_r_d8 =
  (r: Register8Description): OpExec =>
  (cpu, pc) => {
    const value = cpu.memory.read(pc + 1);
    r.write(cpu, value);
    cpu.skip(2);
    cpu.clocks += r.clocks + 8;
  };

export const ld_a_a16: OpExec = (cpu, pc) => {
  const addr = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  const nn = cpu.memory.read(addr);
  cpu.registers[REGISTER.A] = nn;
  cpu.skip(3);
  cpu.clocks += 16;
};

export const ld_a16_a: OpExec = (cpu, pc) => {
  const addr = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  cpu.memory.write(addr, cpu.registers[REGISTER.A]);
  cpu.skip(3);
  cpu.clocks += 16;
};

export const ld_a_c: OpExec = (cpu) => {
  const addr = (0xff00 + cpu.registers[REGISTER.C]) & 0xffff;
  const nn = cpu.memory.read(addr);
  cpu.registers[REGISTER.A] = nn;
  cpu.skip(1);
  cpu.clocks += 8;
};

export const ld_c_a: OpExec = (cpu) => {
  const addr = (0xff00 + cpu.registers[REGISTER.C]) & 0xffff;
  cpu.memory.write(addr, cpu.registers[REGISTER.A]);
  cpu.skip(1);
  cpu.clocks += 8;
};

export const ld_a_r16 =
  (r2: Register16Description): OpExec =>
  (cpu) => {
    const addr = r2.read(cpu);
    const nn = cpu.memory.read(addr);
    cpu.registers[REGISTER.A] = nn;
    cpu.skip(1);
    r2.postCallback(cpu);
    cpu.clocks += 8;
  };

export const ld_r16_a =
  (r1: Register16Description): OpExec =>
  (cpu) => {
    const addr = r1.read(cpu);
    cpu.memory.write(addr, cpu.registers[REGISTER.A]);
    cpu.skip(1);
    r1.postCallback(cpu);
    cpu.clocks += 8;
  };

export const ldh_a8_a: OpExec = (cpu, pc) => {
  const addr = (0xff00 + cpu.memory.read(pc + 1)) & 0xffff;
  cpu.memory.write(addr, cpu.registers[REGISTER.A]);
  cpu.skip(2);
  cpu.clocks += 12;
};

export const ldh_a_a8: OpExec = (cpu, pc) => {
  const addr = (0xff00 + cpu.memory.read(pc + 1)) & 0xffff;
  const nn = cpu.memory.read(addr);
  cpu.registers[REGISTER.A] = nn;
  cpu.skip(2);
  cpu.clocks += 12;
};

export const ld16_r_d16 =
  (r: Register16Description): OpExec =>
  (cpu, pc) => {
    const nn = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
    r.write(cpu, nn);
    cpu.skip(3);
    r.postCallback(cpu);
    cpu.clocks += 12;
  };

export const ld16_a16_sp: OpExec = (cpu, pc) => {
  const addr = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  const value = cpu.registers[REGISTER.SP];
  cpu.memory.write(addr, value & 0xff);
  cpu.memory.write(addr + 1, (value >>> 8) & 0xff);
  cpu.skip(3);
  cpu.clocks += 20;
};

export const ld16_sp_hl: OpExec = (cpu) => {
  cpu.registers[REGISTER.SP] = cpu.readHL();
  cpu.skip(1);
  cpu.clocks += 8;
};

export const ld16_hl_spr8: OpExec = (cpu, pc) => {
  const n1 = cpu.registers[REGISTER.SP];
  let n2 = cpu.memory.read(pc + 1);
  if (n2 & 0x80) {
    n2 = -((~n2 + 1) & 0xff);
  }
  const result = n1 + n2;
  cpu.writeHL(result);
  cpu.aluSetFlags(
    false,
    false,
    ((n1 ^ n2 ^ (result & 0xffff)) & 0x10) === 0x10,
    ((n1 ^ n2 ^ (result & 0xFFFF)) & 0x100) === 0x100,
  );
  cpu.skip(2);
  cpu.clocks += 12;
};
