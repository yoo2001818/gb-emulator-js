import { OpExec } from './types';
import { REGISTER } from '../constants';
import { Register16Description, Register8Description } from './register';
import { getHex16, getHex8 } from './utils';

export const ld =
  (r1: Register8Description, r2: Register8Description): OpExec =>
  (cpu, pc) => {
    const value = r2.read(cpu);
    r1.write(cpu, value);
    cpu.skip(1);
    cpu.tick(r1.clocks + r2.clocks + 1);
    if (cpu.isDebugging) {
      cpu.log('op', `ld ${r1.name}, ${r2.name}`, pc, `${r1.name}=${getHex8(value)}`);
    }
  };

export const ld_r_d8 =
  (r: Register8Description): OpExec =>
  (cpu, pc) => {
    if (r.clocks > 0) cpu.tick(r.clocks);
    const value = cpu.memory.read(pc + 1);
    r.write(cpu, value);
    cpu.skip(2);
    cpu.tick(2);
    if (cpu.isDebugging) {
      cpu.log('op', `ld ${r.name}, ${getHex8(value)}`, pc, `${r.name}=${getHex8(value)}`);
    }
  };

export const ld_a_a16: OpExec = (cpu, pc) => {
  const addr = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  if (!cpu.isTrapResolved && cpu.isBreakpointsEnabled && cpu.readBreakpoints.includes(addr)) {
    cpu.isTrapped = true;
    return;
  }
  cpu.tick(2);
  const nn = cpu.memory.read(addr);
  cpu.registers[REGISTER.A] = nn;
  cpu.skip(3);
  cpu.tick(2);
  if (cpu.isDebugging) {
    cpu.log('op', `ld a, (${getHex16(addr)})`, pc, `a=${getHex8(nn)}`);
  }
};

export const ld_a16_a: OpExec = (cpu, pc) => {
  const addr = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  if (!cpu.isTrapResolved && cpu.isBreakpointsEnabled && cpu.writeBreakpoints.includes(addr)) {
    cpu.isTrapped = true;
    return;
  }
  cpu.tick(2);
  const value = cpu.registers[REGISTER.A];
  cpu.memory.write(addr, value);
  cpu.skip(3);
  cpu.tick(2);
  if (cpu.isDebugging) {
    cpu.log('op', `ld (${getHex16(addr)}), a`, pc, `(${getHex16(addr)})=${getHex8(value)}`);
  }
};

export const ld_a_c: OpExec = (cpu, pc) => {
  const addr = (0xff00 + cpu.registers[REGISTER.C]) & 0xffff;
  if (!cpu.isTrapResolved && cpu.isBreakpointsEnabled && cpu.readBreakpoints.includes(addr)) {
    cpu.isTrapped = true;
    return;
  }
  const nn = cpu.memory.read(addr);
  cpu.registers[REGISTER.A] = nn;
  cpu.skip(1);
  cpu.tick(2);
  if (cpu.isDebugging) {
    cpu.log('op', `ld a, ($ff00 + c)`, pc, `a=${getHex8(nn)} (${getHex16(addr)})`);
  }
};

export const ld_c_a: OpExec = (cpu, pc) => {
  const addr = (0xff00 + cpu.registers[REGISTER.C]) & 0xffff;
  if (!cpu.isTrapResolved && cpu.isBreakpointsEnabled && cpu.writeBreakpoints.includes(addr)) {
    cpu.isTrapped = true;
    return;
  }
  const value = cpu.registers[REGISTER.A];
  cpu.memory.write(addr, value);
  cpu.skip(1);
  cpu.tick(2);
  if (cpu.isDebugging) {
    cpu.log('op', `ld ($ff00 + c), a`, pc, `(${getHex16(addr)})=${getHex8(value)}`);
  }
};

export const ld_a_r16 =
  (r2: Register16Description): OpExec =>
  (cpu, pc) => {
    const addr = r2.read(cpu);
    if (!cpu.isTrapResolved && cpu.isBreakpointsEnabled && cpu.readBreakpoints.includes(addr)) {
      cpu.isTrapped = true;
      return;
    }
    const nn = cpu.memory.read(addr);
    cpu.registers[REGISTER.A] = nn;
    cpu.skip(1);
    r2.postCallback(cpu);
    cpu.tick(2);
    if (cpu.isDebugging) {
      cpu.log('op', `ld a, (${r2.name})`, pc, `a=${getHex8(nn)} (${getHex16(addr)})`);
    }
  };

export const ld_r16_a =
  (r1: Register16Description): OpExec =>
  (cpu, pc) => {
    const addr = r1.read(cpu);
    if (!cpu.isTrapResolved && cpu.isBreakpointsEnabled && cpu.writeBreakpoints.includes(addr)) {
      cpu.isTrapped = true;
      return;
    }
    const nn = cpu.registers[REGISTER.A];
    cpu.memory.write(addr, nn);
    cpu.skip(1);
    r1.postCallback(cpu);
    cpu.tick(2);
    if (cpu.isDebugging) {
      cpu.log('op', `ld (${r1.name}), a`, pc, `(${getHex16(addr)})=${getHex8(nn)}`);
    }
  };

export const ldh_a8_a: OpExec = (cpu, pc) => {
  const addr = (0xff00 + cpu.memory.read(pc + 1)) & 0xffff;
  if (!cpu.isTrapResolved && cpu.isBreakpointsEnabled && cpu.writeBreakpoints.includes(addr)) {
    cpu.isTrapped = true;
    return;
  }
  cpu.tick(1);
  const value = cpu.registers[REGISTER.A];
  cpu.memory.write(addr, value);
  cpu.skip(2);
  cpu.tick(2);
  if (cpu.isDebugging) {
    cpu.log('op', `ldh (${getHex8(addr)}), a`, pc, `(${getHex16(addr)})=${getHex8(value)}`);
  }
};

export const ldh_a_a8: OpExec = (cpu, pc) => {
  const addr = (0xff00 + cpu.memory.read(pc + 1)) & 0xffff;
  if (!cpu.isTrapResolved && cpu.isBreakpointsEnabled && cpu.readBreakpoints.includes(addr)) {
    cpu.isTrapped = true;
    return;
  }
  cpu.tick(1);
  const nn = cpu.memory.read(addr);
  cpu.tick(2);
  cpu.registers[REGISTER.A] = nn;
  cpu.skip(2);
  if (cpu.isDebugging) {
    cpu.log('op', `ldh a, (${getHex8(addr)})`, pc, `a=${getHex8(nn)}`);
  }
};

export const ld16_r_d16 =
  (r: Register16Description): OpExec =>
  (cpu, pc) => {
    const nn = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
    r.write(cpu, nn);
    cpu.skip(3);
    r.postCallback(cpu);
    cpu.tick(3);
    if (cpu.isDebugging) {
      cpu.log('op', `ld ${r.name}, ${getHex16(nn)}`, pc, `${r.name}=${getHex16(nn)}`);
    }
  };

export const ld16_a16_sp: OpExec = (cpu, pc) => {
  const addr = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  if (!cpu.isTrapResolved && cpu.isBreakpointsEnabled && cpu.writeBreakpoints.includes(addr)) {
    cpu.isTrapped = true;
    return;
  }
  const value = cpu.registers[REGISTER.SP];
  cpu.memory.write(addr, value & 0xff);
  cpu.memory.write(addr + 1, (value >>> 8) & 0xff);
  cpu.skip(3);
  cpu.tick(5);
  if (cpu.isDebugging) {
    cpu.log('op', `ld (${getHex16(addr)}), sp`, pc, `(${getHex16(addr)})=${getHex16(value)}`);
  }
};

export const ld16_sp_hl: OpExec = (cpu, pc) => {
  cpu.registers[REGISTER.SP] = cpu.readHL();
  cpu.skip(1);
  cpu.tick(2);
  if (cpu.isDebugging) {
    cpu.log('op', `ld sp, hl`, pc, `sp=${getHex16(cpu.readHL())}`);
  }
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
  cpu.tick(3);
  if (cpu.isDebugging) {
    if (n2 > 0) {
      cpu.log('op', `ld hl, (sp + ${getHex8(n2)})`, pc, `hl=${getHex16(result)} sp=${getHex16(n1)}`);
    } else {
      cpu.log('op', `ld hl, (sp - ${getHex8(-n2)})`, pc, `hl=${getHex16(result)} sp=${getHex16(n1)}`);
    }
  }
};
