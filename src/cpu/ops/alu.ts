import { CPU } from '../cpu';
import { OpExec } from './types';
import { FLAG, REGISTER } from '../constants';
import { Register8Description } from './register';

export type ALUUnaryOp = (cpu: CPU, a: number) => number;
export type ALUBinaryOp = (cpu: CPU, a: number, b: number) => number;

export const alu_add: ALUBinaryOp = (cpu, a, b) => {
  const result = a + b;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    (((a & 0xf) + (b & 0xf)) & 0x10) !== 0,
    (result & 0x100) !== 0
  );
  return result & 0xff;
};
export const alu_adc: ALUBinaryOp = (cpu, a, b) => {
  const carry = cpu.getFlag(FLAG.C) ? 1 : 0;
  const result = a + b + carry;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    (((a & 0xf) + (b & 0xf) + carry) & 0x10) !== 0,
    (result & 0x100) !== 0
  );
  return result & 0xff;
};
export const alu_sub: ALUBinaryOp = (cpu, a, b) => {
  const result = a - b;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    true,
    (((a & 0xf) - (b & 0xf)) | 0) < 0,
    result < 0,
  );
  return result & 0xff;
};
export const alu_sbc: ALUBinaryOp = (cpu, a, b) => {
  const carry = cpu.getFlag(FLAG.C) ? 1 : 0;
  const result = a - b - carry;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    true,
    (((a & 0xf) - (b & 0xf) - carry) & 0x10) !== 0,
    result < 0,
  );
  return result & 0xff;
};
export const alu_and: ALUBinaryOp = (cpu, a, b) => {
  const result = a & b;
  cpu.aluSetFlags((result & 0xff) === 0, false, true, false);
  return result & 0xff;
};
export const alu_or: ALUBinaryOp = (cpu, a, b) => {
  const result = a | b;
  cpu.aluSetFlags((result & 0xff) === 0, false, false, false);
  return result & 0xff;
};
export const alu_xor: ALUBinaryOp = (cpu, a, b) => {
  const result = a ^ b;
  cpu.aluSetFlags((result & 0xff) === 0, false, false, false);
  return result & 0xff;
};
export const alu_cp: ALUBinaryOp = (cpu, a, b) => {
  const result = a - b;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    true,
    (((a & 0xf) - (b & 0xf)) | 0) < 0,
    result < 0,
  );
  return a;
};

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

export const alu_binary =
  (op: ALUBinaryOp, r2: Register8Description): OpExec =>
  (cpu) => {
    const n1 = cpu.registers[REGISTER.A];
    const n2 = r2.read(cpu);
    cpu.registers[REGISTER.A] = op(cpu, n1, n2);
    cpu.skip(1);
    cpu.tick(1 + r2.clocks);
  };

export const alu_binary_imm =
  (op: ALUBinaryOp): OpExec =>
  (cpu, pc) => {
    const n1 = cpu.registers[REGISTER.A];
    const n2 = cpu.memory.read(pc + 1);
    cpu.registers[REGISTER.A] = op(cpu, n1, n2);
    cpu.skip(2);
    cpu.tick(2);
  };

export const alu_unary =
  (op: ALUUnaryOp, r: Register8Description, clocks: number): OpExec =>
  (cpu) => {
    if (clocks === 4) {
      const n = r.read(cpu);
      if (r.clocks > 0) cpu.tick(r.clocks);
      r.write(cpu, op(cpu, n));
      cpu.skip(1);
      if (r.clocks > 0) {
        cpu.tick(r.clocks + clocks);
      } else {
        cpu.tick(clocks);
      }
    } else {
      if (r.clocks > 0) cpu.tick(r.clocks);
      const n = r.read(cpu);
      if (r.clocks > 0) cpu.tick(r.clocks);
      r.write(cpu, op(cpu, n));
      cpu.skip(1);
      cpu.tick(clocks);
    }
  };

export const alu_unary_read =
  (op: ALUUnaryOp, r: Register8Description, clocks: number): OpExec =>
  (cpu) => {
    if (r.clocks > 0) cpu.tick(r.clocks);
    const n = r.read(cpu);
    op(cpu, n);
    cpu.skip(1);
    cpu.tick(clocks);
  };

export const alu_inc: ALUUnaryOp = (cpu, n) => {
  const result = n + 1;
  cpu.aluSetFlags(
    n === 0xff,
    false,
    (n & 0xf) === 0xf,
    cpu.getFlag(FLAG.C),
  );
  return result & 0xff;
};
export const alu_dec: ALUUnaryOp = (cpu, n) => {
  const result = n - 1;
  cpu.aluSetFlags(
    n === 1,
    true,
    (n & 0xf) === 0,
    cpu.getFlag(FLAG.C),
  );
  return result & 0xff;
};
export const alu_swap: ALUUnaryOp = (cpu, n) => {
  const result = ((n & 0xf) << 4) | ((n >>> 4) & 0xf);
  cpu.aluSetFlags((result & 0xff) === 0, false, false, false);
  return result & 0xff;
};
export const alu_rlc = (useZero: boolean): ALUUnaryOp => (cpu, n) => {
  const oldBit = n & 0x80;
  const result = ((n << 1) & 0xff) | (oldBit >>> 7);
  cpu.aluSetFlags(useZero && result === 0, false, false, oldBit !== 0);
  return result;
};
export const alu_rl = (useZero: boolean): ALUUnaryOp => (cpu, n) => {
  const carry = cpu.getFlag(FLAG.C) ? 1 : 0;
  const oldBit = n & 0x80;
  const result = ((n << 1) & 0xff) | carry;
  cpu.aluSetFlags(useZero && result === 0, false, false, oldBit !== 0);
  return result;
};
export const alu_rrc = (useZero: boolean): ALUUnaryOp => (cpu, n) => {
  const oldBit = n & 0x01;
  const result = ((n >>> 1) & 0xff) | (oldBit << 7);
  cpu.aluSetFlags(useZero && result === 0, false, false, oldBit !== 0);
  return result;
};
export const alu_rr = (useZero: boolean): ALUUnaryOp => (cpu, n) => {
  const carry = cpu.getFlag(FLAG.C) ? 1 : 0;
  const oldBit = n & 0x01;
  const result = ((n >>> 1) & 0xff) | (carry << 7);
  cpu.aluSetFlags(useZero && result === 0, false, false, oldBit !== 0);
  return result;
};
export const alu_sla: ALUUnaryOp = (cpu, n) => {
  const oldBit = n & 0x80;
  const result = (n << 1) & 0xff;
  cpu.aluSetFlags(result === 0, false, false, oldBit !== 0);
  return result;
};
export const alu_sra: ALUUnaryOp = (cpu, n) => {
  const oldBit = n & 0x01;
  const result = ((n >>> 1) & 0xff) | (n & 0x80);
  cpu.aluSetFlags(result === 0, false, false, oldBit !== 0);
  return result;
};
export const alu_srl: ALUUnaryOp = (cpu, n) => {
  const oldBit = n & 0x01;
  const result = (n >>> 1) & 0xff;
  cpu.aluSetFlags(result === 0, false, false, oldBit !== 0);
  return result;
};
export const alu_bit =
  (bit: number): ALUUnaryOp =>
  (cpu, n) => {
    const bitMask = 1 << bit;
    const result = bitMask & n & 0xff;
    cpu.aluSetFlags(result === 0, false, true, cpu.getFlag(FLAG.C));
    return n;
  };
export const alu_set =
  (bit: number): ALUUnaryOp =>
  (cpu, n) => {
    const bitMask = 1 << bit;
    const result = (bitMask | n) & 0xff;
    return result;
  };
export const alu_res =
  (bit: number): ALUUnaryOp =>
  (cpu, n) => {
    const bitMask = ~(1 << bit);
    const result = n & (bitMask & 0xff);
    return result;
  };

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
