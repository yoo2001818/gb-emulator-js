import { CPU } from '../cpu';
import { OpExec } from './types';
import { REGISTER } from '../constants';
import { getHex16, getHex8 } from './utils';

export const jp_a16: OpExec = (cpu, pc) => {
  const nn1 = cpu.memory.read(pc + 1);
  cpu.tick(1);
  const nn2 = cpu.memory.read(pc + 2);
  cpu.tick(3);
  const nn = nn1 | (nn2 << 8);
  cpu.registers[REGISTER.PC] = nn;
  if (cpu.isDebugging) {
    cpu.log('op', `jp ${getHex16(nn)}`, pc, `pc=${getHex16(nn)}`);
  }
};

export const jp_cond_a16 =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    if (cond(cpu)) {
      const nn1 = cpu.memory.read(pc + 1);
      cpu.tick(1);
      const nn2 = cpu.memory.read(pc + 2);
      cpu.tick(3);
      const nn = nn1 | (nn2 << 8);
      cpu.registers[REGISTER.PC] = nn;
      if (cpu.isDebugging) {
        cpu.log('op', `jp ${cond.name}, ${getHex16(nn)}`, pc, `pc=${getHex16(nn)}`);
      }
    } else {
      cpu.skip(3);
      cpu.tick(3);
      if (cpu.isDebugging) {
        const nn1 = cpu.memory.read(pc + 1);
        const nn2 = cpu.memory.read(pc + 2);
        const nn = nn1 | (nn2 << 8);
        cpu.log('op', `jp ${cond.name}, ${getHex16(nn)}`, pc, `skip`);
      }
    }
  };

export const jp_hl: OpExec = (cpu, pc) => {
  const nn = cpu.readHL();
  cpu.registers[REGISTER.PC] = nn;
  cpu.tick(1);
  if (cpu.isDebugging) {
    cpu.log('op', `jp hl`, pc, `pc=${getHex16(nn)}`);
  }
};

export const jr_r8: OpExec = (cpu, pc) => {
  let n = cpu.memory.read(pc + 1);
  if (n & 0x80) {
    n = -((~n + 1) & 0xff);
  }
  const result = (cpu.registers[REGISTER.PC] + 2 + n) & 0xffff;
  cpu.registers[REGISTER.PC] = result;
  cpu.tick(3);
  if (cpu.isDebugging) {
    if (n > 0) {
      cpu.log('op', `jr ${getHex8(n)}`, pc, `pc=${getHex16(result)}`);
    } else {
      cpu.log('op', `jr -${getHex8(-n)}`, pc, `pc=${getHex16(result)}`);
    }
  }
};

export const jr_cond_r8 =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    let n = cpu.memory.read(pc + 1);
    if (n & 0x80) {
      n = -((~n + 1) & 0xff);
    }
    let extraMsg = 'skip';
    if (cond(cpu)) {
      const result = (cpu.registers[REGISTER.PC] + 2 + n) & 0xffff;
      cpu.registers[REGISTER.PC] = result;
      cpu.tick(3);
      if (cpu.isDebugging) {
        extraMsg = `pc=${getHex16(result)}`;
      }
    } else {
      cpu.skip(2);
      cpu.tick(2);
    }
    if (cpu.isDebugging) {
      if (n > 0) {
        cpu.log('op', `jr ${cond.name}, ${getHex8(n)}`, pc, extraMsg);
      } else {
        cpu.log('op', `jr ${cond.name}, -${getHex8(-n)}`, pc, extraMsg);
      }
    }
  };

export const call_a16: OpExec = (cpu, pc) => {
  // read memory
  const nn1 = cpu.memory.read(pc + 1);
  cpu.tick(1);
  const nn2 = cpu.memory.read(pc + 2);
  cpu.tick(2);
  const nn = nn1 | (nn2 << 8);
  // push
  const value = pc + 3;
  const sp = cpu.registers[REGISTER.SP];
  cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
  cpu.tick(1);
  cpu.memory.write(sp - 2, value & 0xff);
  cpu.tick(2);
  const spNext = (sp - 2) & 0xffff;
  cpu.registers[REGISTER.SP] = spNext;
  // finish jmp
  cpu.registers[REGISTER.PC] = nn;
  if (cpu.isDebugging) {
    cpu.log('op', `call ${getHex16(nn)}`, pc, `pc=${getHex16(nn)} sp=${getHex16(spNext)}`);
  }
};

export const call_cond_a16 =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    if (cond(cpu)) {
      // Read memory
      const nn1 = cpu.memory.read(pc + 1);
      cpu.tick(1);
      const nn2 = cpu.memory.read(pc + 2);
      cpu.tick(2);
      const nn = nn1 | (nn2 << 8);
      // push
      const value = pc + 3;
      const sp = cpu.registers[REGISTER.SP];
      cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
      cpu.tick(1);
      cpu.memory.write(sp - 2, value & 0xff);
      cpu.tick(2);
      const spNext = (sp - 2) & 0xffff;
      cpu.registers[REGISTER.SP] = spNext;
      // jmp
      cpu.registers[REGISTER.PC] = nn;
      if (cpu.isDebugging) {
        cpu.log('op', `call ${cond.name}, ${getHex16(nn)}`, pc, `pc=${getHex16(nn)} sp=${getHex16(spNext)}`);
      }
    } else {
      cpu.skip(3);
      cpu.tick(3);
      if (cpu.isDebugging) {
        const nn1 = cpu.memory.read(pc + 1);
        const nn2 = cpu.memory.read(pc + 2);
        const nn = nn1 | (nn2 << 8);
        cpu.log('op', `call ${cond.name}, ${getHex16(nn)}`, pc, 'skip');
      }
    }
  };

export const rst_nn =
  (n: number): OpExec =>
  (cpu, pc) => {
    cpu.tick(1);
    // push
    const value = pc + 1;
    const sp = cpu.registers[REGISTER.SP];
    cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
    cpu.tick(1);
    cpu.memory.write(sp - 2, value & 0xff);
    cpu.tick(2);
    const spNext = (sp - 2) & 0xffff;
    cpu.registers[REGISTER.SP] = spNext;
    // jmp
    cpu.registers[REGISTER.PC] = n;
    if (cpu.isDebugging) {
      cpu.log('op', `rst ${getHex8(n)}`, pc, `pc=${getHex16(n)} sp=${getHex16(spNext)}`);
    }
  };

export const ret: OpExec = (cpu, pc) => {
  // pop
  const sp = cpu.registers[REGISTER.SP];
  const value1 = cpu.memory.read(sp);
  cpu.tick(1);
  const value2 = cpu.memory.read(sp + 1);
  cpu.tick(3);
  const value = value1 | (value2 << 8);
  const spNext = (sp + 2) & 0xffff;
  cpu.registers[REGISTER.SP] = spNext;
  // jmp
  cpu.registers[REGISTER.PC] = value;
  if (cpu.isDebugging) {
    cpu.log('op', 'ret', pc, `pc=${getHex16(value)} sp=${getHex16(spNext)}`);
  }
};

export const ret_cond =
  (cond: (cpu: CPU) => boolean): OpExec =>
  (cpu, pc) => {
    if (cond(cpu)) {
      // pop
      const sp = cpu.registers[REGISTER.SP];
      cpu.tick(1);
      const value1 = cpu.memory.read(sp);
      cpu.tick(1);
      const value2 = cpu.memory.read(sp + 1);
      cpu.tick(3);
      const value = value1 | (value2 << 8);
      const spNext = (sp + 2) & 0xffff;
      cpu.registers[REGISTER.SP] = spNext;
      // jmp
      cpu.registers[REGISTER.PC] = value;
      if (cpu.isDebugging) {
        cpu.log('op', `ret ${cond.name}`, pc, `pc=${getHex16(value)} sp=${getHex16(spNext)}`);
      }
    } else {
      cpu.skip(1);
      cpu.tick(2);
      if (cpu.isDebugging) {
        cpu.log('op', `ret ${cond.name}`, pc, 'skip');
      }
    }
  };

export const reti: OpExec = (cpu, pc) => {
  // pop
  const sp = cpu.registers[REGISTER.SP];
  const value1 = cpu.memory.read(sp);
  cpu.tick(1);
  const value2 = cpu.memory.read(sp + 1);
  cpu.tick(3);
  const value = value1 | (value2 << 8);
  const spNext = (sp + 2) & 0xffff;
  cpu.registers[REGISTER.SP] = spNext;
  // jmp
  cpu.registers[REGISTER.PC] = value;
  // enable interrupts
  cpu.isInterruptsEnabledNext = true;
  if (cpu.isDebugging) {
    cpu.log('op', 'reti', pc, `pc=${getHex16(value)} sp=${getHex16(spNext)}`);
  }
};
