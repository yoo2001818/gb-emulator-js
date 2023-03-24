import { OpExec } from './types';
import { FLAG, REGISTER } from '../constants';
import { Register16Description } from './register';
import { getHex16, getHex8 } from './utils';

export const nop: OpExec = (cpu, pc) => {
  cpu.tick(1);
  cpu.skip(1);
  if (cpu.isDebugging) {
    cpu.log('op', 'nop', pc);
  }
};

export const push =
  (r: Register16Description): OpExec =>
  (cpu, pc) => {
    cpu.tick(1);
    const value = r.read(cpu);
    const sp = cpu.registers[REGISTER.SP] - 2;
    cpu.memory.write(sp + 1, (value >>> 8) & 0xff);
    cpu.tick(1);
    cpu.memory.write(sp, value & 0xff);
    cpu.tick(2);
    cpu.registers[REGISTER.SP] = sp;
    cpu.skip(1);
    r.postCallback(cpu);
    if (cpu.isDebugging) {
      cpu.log(
        'op',
        `push ${r.name}`,
        pc,
        `${r.name}=${getHex16(value)} sp=${getHex16(sp)}`
      );
    }
  };

export const pop =
  (r: Register16Description): OpExec =>
  (cpu, pc) => {
    const sp = cpu.registers[REGISTER.SP];
    const value1 = cpu.memory.read(sp);
    cpu.tick(1);
    const value2 = cpu.memory.read(sp + 1);
    cpu.tick(2);
    const value = value1 | (value2 << 8);
    r.write(cpu, value);
    cpu.registers[REGISTER.SP] += 2;
    cpu.skip(1);
    r.postCallback(cpu);
    if (cpu.isDebugging) {
      cpu.log(
        'op',
        `pop ${r.name}`,
        pc,
        `${r.name}=${getHex16(value)} sp=${getHex16(sp)}`
      );
    }
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
      (((n1 & 0xfff) + (n2 & 0xfff)) & 0x1000) !== 0,
      (result & 0x10000) !== 0
    );
    r1.write(cpu, result & 0xffff);
    cpu.skip(1);
    r1.postCallback(cpu);
    r2.postCallback(cpu);
    cpu.tick(2);
    if (cpu.isDebugging) {
      cpu.log(
        'op',
        `add ${r1.name}, ${r2.name}`,
        pc,
        `${r1.name}=${getHex16(result & 0xffff)} (${getHex16(n1)}, ${getHex16(
          n2
        )}) ${cpu.getDebugFlags()}`
      );
    }
  };

export const add16_sp_n: OpExec = (cpu, pc) => {
  const n1 = cpu.registers[REGISTER.SP];
  let n2 = cpu.memory.read(pc + 1);
  if (n2 & 0x80) {
    n2 = -((~n2 + 1) & 0xff);
  }
  const result = n1 + n2;
  cpu.aluSetFlags(
    false,
    false,
    ((n1 ^ n2 ^ (result & 0xffff)) & 0x10) === 0x10,
    ((n1 ^ n2 ^ (result & 0xffff)) & 0x100) === 0x100
  );
  cpu.registers[REGISTER.SP] = result & 0xffff;
  cpu.skip(2);
  cpu.tick(4);
  if (cpu.isDebugging) {
    cpu.log(
      'op',
      `add sp, ${n2}`,
      pc,
      `sp=${getHex16(result & 0xffff)} ${cpu.getDebugFlags()}`
    );
  }
};

export const inc16 =
  (r: Register16Description): OpExec =>
  (cpu, pc) => {
    const n1 = r.read(cpu);
    const result = n1 + 1;
    r.write(cpu, result & 0xffff);
    cpu.skip(1);
    r.postCallback(cpu);
    cpu.tick(2);
    if (cpu.isDebugging) {
      cpu.log('op', `inc ${r.name}`, pc, `${r.name}=${getHex16(result)}`);
    }
  };

export const dec16 =
  (r: Register16Description): OpExec =>
  (cpu, pc) => {
    const n1 = r.read(cpu);
    const result = n1 - 1;
    r.write(cpu, result & 0xffff);
    cpu.skip(1);
    r.postCallback(cpu);
    cpu.tick(2);
    if (cpu.isDebugging) {
      cpu.log('op', `dec ${r.name}`, pc, `${r.name}=${getHex16(result)}`);
    }
  };

export const daa: OpExec = (cpu, pc) => {
  let value = cpu.registers[REGISTER.A];
  let carry = false;
  let correction = 0;
  if (cpu.getFlag(FLAG.H) || (!cpu.getFlag(FLAG.N) && (value & 0xf) > 9)) {
    correction |= 0x6;
  }
  if (cpu.getFlag(FLAG.C) || (!cpu.getFlag(FLAG.N) && value > 0x99)) {
    correction |= 0x60;
    carry = true;
  }
  value += cpu.getFlag(FLAG.N) ? -correction : correction;
  cpu.aluSetFlags((value & 0xff) === 0, cpu.getFlag(FLAG.N), false, carry);
  cpu.registers[REGISTER.A] = value & 0xff;
  cpu.skip(1);
  cpu.tick(1);
  if (cpu.isDebugging) {
    cpu.log(
      'op',
      `daa`,
      pc,
      `a=${getHex8(value & 0xff)} ${cpu.getDebugFlags()}`
    );
  }
};

export const cpl: OpExec = (cpu, pc) => {
  const result = cpu.registers[REGISTER.A] ^ 0xff;
  cpu.aluSetFlags(cpu.getFlag(FLAG.Z), true, true, cpu.getFlag(FLAG.C));
  cpu.registers[REGISTER.A] = result;
  cpu.skip(1);
  cpu.tick(1);
  if (cpu.isDebugging) {
    cpu.log(
      'op',
      `cpl`,
      pc,
      `a=${getHex8(result & 0xff)} ${cpu.getDebugFlags()}`
    );
  }
};

export const ccf: OpExec = (cpu, pc) => {
  cpu.aluSetFlags(cpu.getFlag(FLAG.Z), false, false, !cpu.getFlag(FLAG.C));
  cpu.skip(1);
  cpu.tick(1);
  if (cpu.isDebugging) {
    cpu.log('op', `ccf`, pc, `${cpu.getDebugFlags()}`);
  }
};

export const scf: OpExec = (cpu, pc) => {
  cpu.aluSetFlags(cpu.getFlag(FLAG.Z), false, false, true);
  cpu.skip(1);
  cpu.tick(1);
  if (cpu.isDebugging) {
    cpu.log('op', `scf`, pc, `${cpu.getDebugFlags()}`);
  }
};

export const halt: OpExec = (cpu, pc) => {
  cpu.isRunning = false;
  cpu.skip(1);
  cpu.tick(1);
  if (cpu.isDebugging) {
    cpu.log('op', `halt`, pc, `IME=${cpu.isInterruptsEnabled}`);
  }
};

export const stop: OpExec = (cpu, pc) => {
  cpu.isStopped = true;
  cpu.isRunning = false;
  cpu.skip(2);
  cpu.tick(1);
  if (cpu.isDebugging) {
    cpu.log('op', `stop`, pc);
  }
};

export const di: OpExec = (cpu, pc) => {
  cpu.isInterruptsEnabled = false;
  cpu.isInterruptsEnabledNext = false;
  cpu.skip(1);
  cpu.tick(1);
  if (cpu.isDebugging) {
    cpu.log('op', `di`, pc);
  }
};

export const ei: OpExec = (cpu, pc) => {
  cpu.isInterruptsEnabledNext = true;
  cpu.skip(1);
  cpu.tick(1);
  if (cpu.isDebugging) {
    cpu.log('op', `ei`, pc);
  }
};
