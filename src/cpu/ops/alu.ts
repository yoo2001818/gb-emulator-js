import { CPU } from '../cpu';
import { OpExec } from './types';
import { FLAG, REGISTER } from '../constants';
import { Register8Description } from './register';
import { getHex8 } from './utils';

export type ALUUnaryOp = ((cpu: CPU, a: number) => number) & { opName: string, param?: string };
export type ALUBinaryOp = ((cpu: CPU, a: number, b: number) => number) & { opName: string };

function createUnaryOp(name: string, callback: (cpu: CPU, a: number) => number): ALUUnaryOp {
  const func = callback as ALUUnaryOp;
  func.opName = name;
  return func;
}

function createUnaryOpWithParam(name: string, param: string, callback: (cpu: CPU, a: number) => number): ALUUnaryOp {
  const func = callback as ALUUnaryOp;
  func.opName = name;
  func.param = param;
  return func;
}

function createBinaryOp(name: string, callback: (cpu: CPU, a: number, b: number) => number): ALUBinaryOp {
  const func = callback as ALUBinaryOp;
  func.opName = name;
  return func;
}

export const alu_add = createBinaryOp('add', (cpu, a, b) => {
  const result = a + b;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    (((a & 0xf) + (b & 0xf)) & 0x10) !== 0,
    (result & 0x100) !== 0
  );
  return result & 0xff;
});
export const alu_adc = createBinaryOp('adc', (cpu, a, b) => {
  const carry = cpu.getFlag(FLAG.C) ? 1 : 0;
  const result = a + b + carry;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    (((a & 0xf) + (b & 0xf) + carry) & 0x10) !== 0,
    (result & 0x100) !== 0
  );
  return result & 0xff;
});
export const alu_sub = createBinaryOp('sub', (cpu, a, b) => {
  const result = a - b;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    true,
    (((a & 0xf) - (b & 0xf)) | 0) < 0,
    result < 0,
  );
  return result & 0xff;
});
export const alu_sbc = createBinaryOp('sbc', (cpu, a, b) => {
  const carry = cpu.getFlag(FLAG.C) ? 1 : 0;
  const result = a - b - carry;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    true,
    (((a & 0xf) - (b & 0xf) - carry) & 0x10) !== 0,
    result < 0,
  );
  return result & 0xff;
});
export const alu_and = createBinaryOp('and', (cpu, a, b) => {
  const result = a & b;
  cpu.aluSetFlags((result & 0xff) === 0, false, true, false);
  return result & 0xff;
});
export const alu_or = createBinaryOp('or', (cpu, a, b) => {
  const result = a | b;
  cpu.aluSetFlags((result & 0xff) === 0, false, false, false);
  return result & 0xff;
});
export const alu_xor = createBinaryOp('xor', (cpu, a, b) => {
  const result = a ^ b;
  cpu.aluSetFlags((result & 0xff) === 0, false, false, false);
  return result & 0xff;
});
export const alu_cp = createBinaryOp('cp', (cpu, a, b) => {
  const result = a - b;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    true,
    (((a & 0xf) - (b & 0xf)) | 0) < 0,
    result < 0,
  );
  return a;
});

export const binary_ops = [
  alu_add,
  alu_adc,
  alu_sub,
  alu_sbc,
  alu_and,
  alu_xor,
  alu_or,
  alu_cp,
];

export const alu_inc = createUnaryOp('inc', (cpu, n) => {
  const result = n + 1;
  cpu.aluSetFlags(
    n === 0xff,
    false,
    (n & 0xf) === 0xf,
    cpu.getFlag(FLAG.C),
  );
  return result & 0xff;
});

export const alu_dec = createUnaryOp('dec', (cpu, n) => {
  const result = n - 1;
  cpu.aluSetFlags(
    n === 1,
    true,
    (n & 0xf) === 0,
    cpu.getFlag(FLAG.C),
  );
  return result & 0xff;
});
export const alu_swap = createUnaryOp('swap', (cpu, n) => {
  const result = ((n & 0xf) << 4) | ((n >>> 4) & 0xf);
  cpu.aluSetFlags((result & 0xff) === 0, false, false, false);
  return result & 0xff;
});
export const alu_rlc = (useZero: boolean) => createUnaryOp(useZero ? 'rlc' : 'rlca', (cpu, n) => {
  const oldBit = n & 0x80;
  const result = ((n << 1) & 0xff) | (oldBit >>> 7);
  cpu.aluSetFlags(useZero && result === 0, false, false, oldBit !== 0);
  return result;
});
export const alu_rl = (useZero: boolean) => createUnaryOp(useZero ? 'rl' : 'rla', (cpu, n) => {
  const carry = cpu.getFlag(FLAG.C) ? 1 : 0;
  const oldBit = n & 0x80;
  const result = ((n << 1) & 0xff) | carry;
  cpu.aluSetFlags(useZero && result === 0, false, false, oldBit !== 0);
  return result;
});
export const alu_rrc = (useZero: boolean) => createUnaryOp(useZero ? 'rrc' : 'rrca', (cpu, n) => {
  const oldBit = n & 0x01;
  const result = ((n >>> 1) & 0xff) | (oldBit << 7);
  cpu.aluSetFlags(useZero && result === 0, false, false, oldBit !== 0);
  return result;
});
export const alu_rr = (useZero: boolean) => createUnaryOp(useZero ? 'rr' : 'rra', (cpu, n) => {
  const carry = cpu.getFlag(FLAG.C) ? 1 : 0;
  const oldBit = n & 0x01;
  const result = ((n >>> 1) & 0xff) | (carry << 7);
  cpu.aluSetFlags(useZero && result === 0, false, false, oldBit !== 0);
  return result;
});
export const alu_sla = createUnaryOp('sla', (cpu, n) => {
  const oldBit = n & 0x80;
  const result = (n << 1) & 0xff;
  cpu.aluSetFlags(result === 0, false, false, oldBit !== 0);
  return result;
});
export const alu_sra = createUnaryOp('sra', (cpu, n) => {
  const oldBit = n & 0x01;
  const result = ((n >>> 1) & 0xff) | (n & 0x80);
  cpu.aluSetFlags(result === 0, false, false, oldBit !== 0);
  return result;
});
export const alu_srl = createUnaryOp('srl', (cpu, n) => {
  const oldBit = n & 0x01;
  const result = (n >>> 1) & 0xff;
  cpu.aluSetFlags(result === 0, false, false, oldBit !== 0);
  return result;
});
export const alu_bit = (bit: number) => createUnaryOpWithParam('bit', bit.toString(), (cpu, n) => {
  const bitMask = 1 << bit;
  const result = bitMask & n & 0xff;
  cpu.aluSetFlags(result === 0, false, true, cpu.getFlag(FLAG.C));
  return n;
});
export const alu_set = (bit: number) => createUnaryOpWithParam('set', bit.toString(), (cpu, n) => {
  const bitMask = 1 << bit;
  const result = (bitMask | n) & 0xff;
  return result;
});
export const alu_res = (bit: number) => createUnaryOpWithParam('res', bit.toString(), (cpu, n) => {
  const bitMask = ~(1 << bit);
  const result = n & (bitMask & 0xff);
  return result;
});

export const unary_ops = [
  alu_rlc(true),
  alu_rrc(true),
  alu_rl(true),
  alu_rr(true),
  alu_sla,
  alu_sra,
  alu_swap,
  alu_srl,
];

export const alu_binary =
  (op: ALUBinaryOp, r2: Register8Description): OpExec =>
  (cpu, pc) => {
    const n1 = cpu.registers[REGISTER.A];
    const n2 = r2.read(cpu);
    const result = op(cpu, n1, n2);
    cpu.registers[REGISTER.A] = result;
    cpu.skip(1);
    cpu.tick(1 + r2.clocks);
    if (cpu.isDebugging) {
      cpu.log('op', `${op.opName} ${r2.name}`, pc, `a=${getHex8(result)} (${getHex8(n1)}, ${getHex8(n2)}) ${cpu.getDebugFlags()}`);
    }
  };

export const alu_binary_imm =
  (op: ALUBinaryOp): OpExec =>
  (cpu, pc) => {
    const n1 = cpu.registers[REGISTER.A];
    const n2 = cpu.memory.read(pc + 1);
    const result = op(cpu, n1, n2);
    cpu.registers[REGISTER.A] = result;
    cpu.skip(2);
    cpu.tick(2);
    if (cpu.isDebugging) {
      cpu.log('op', `${op.opName} ${getHex8(n2)}`, pc, `a=${getHex8(result)} (${getHex8(n1)}) ${cpu.getDebugFlags()}`);
    }
  };

export const alu_unary =
  (op: ALUUnaryOp, r: Register8Description, clocks: number): OpExec =>
  (cpu, pc) => {
    let n;
    if (clocks === 1) {
      n = r.read(cpu);
      if (r.clocks > 0) cpu.tick(r.clocks);
      r.write(cpu, op(cpu, n));
      cpu.skip(1);
      cpu.tick(r.clocks + clocks);
    } else {
      if (r.clocks > 0) cpu.tick(r.clocks);
      n = r.read(cpu);
      if (r.clocks > 0) cpu.tick(r.clocks);
      r.write(cpu, op(cpu, n));
      cpu.skip(1);
      cpu.tick(clocks);
    }
    if (cpu.isDebugging) {
      cpu.log('op', `${op.opName} ${op.param ? `${op.param}, ` : ''}${r.name}`, pc, `${r.name}=${getHex8(n)} ${cpu.getDebugFlags()}`);
    }
  };

export const alu_unary_read =
  (op: ALUUnaryOp, r: Register8Description, clocks: number): OpExec =>
  (cpu, pc) => {
    if (r.clocks > 0) cpu.tick(r.clocks);
    const n = r.read(cpu);
    op(cpu, n);
    cpu.skip(1);
    cpu.tick(clocks);
    if (cpu.isDebugging) {
      cpu.log('op', `${op.opName} ${op.param ? `${op.param}, ` : ''}${r.name}`, pc, `${r.name}=${getHex8(n)} ${cpu.getDebugFlags()}`);
    }
  };

