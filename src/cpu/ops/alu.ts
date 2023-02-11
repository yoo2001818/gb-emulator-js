import { CPU } from '../cpu';
import { OpExec } from './type';
import { FLAG, REGISTER } from '../register';
import { Register8Description } from './register';

export type ALUUnaryOp = (cpu: CPU, a: number) => number;
export type ALUBinaryOp = (cpu: CPU, a: number, b: number) => number;

export const alu_add: ALUBinaryOp = (cpu, a, b) => cpu.aluAdd(a, b);
export const alu_adc: ALUBinaryOp = (cpu, a, b) => cpu.aluAdc(a, b);
export const alu_sub: ALUBinaryOp = (cpu, a, b) => cpu.aluSub(a, b);
export const alu_sbc: ALUBinaryOp = (cpu, a, b) => cpu.aluSbc(a, b);
export const alu_and: ALUBinaryOp = (cpu, a, b) => cpu.aluAnd(a, b);
export const alu_or: ALUBinaryOp = (cpu, a, b) => cpu.aluOr(a, b);
export const alu_xor: ALUBinaryOp = (cpu, a, b) => cpu.aluXor(a, b);
export const alu_cp: ALUBinaryOp = (cpu, a, b) => cpu.aluCp(a, b);

export const binary_ops = [
  alu_add,
  alu_adc,
  alu_sub,
  alu_sbc,
  alu_and,
  alu_or,
  alu_xor,
  alu_cp,
];

export const alu_binary =
  (op: ALUBinaryOp, r2: Register8Description): OpExec =>
  (cpu) => {
    const n1 = cpu.registers[REGISTER.A];
    const n2 = r2.read(cpu);
    cpu.registers[REGISTER.A] = op(cpu, n1, n2);
    cpu.skip(1);
  };

export const alu_binary_imm =
  (op: ALUBinaryOp): OpExec =>
  (cpu, pc) => {
    const n1 = cpu.registers[REGISTER.A];
    const n2 = cpu.memory.read(pc + 1);
    cpu.registers[REGISTER.A] = op(cpu, n1, n2);
    cpu.skip(2);
  };

export const alu_unary =
  (op: ALUUnaryOp, r: Register8Description): OpExec =>
  (cpu) => {
    const n = r.read(cpu);
    r.write(cpu, op(cpu, n));
    cpu.skip(1);
  };

export const alu_inc: ALUUnaryOp = (cpu, n) => {
  const result = n + 1;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    (result & 0x10) !== 0,
    cpu.getFlag(FLAG.C)
  );
  return result & 0xff;
};
export const alu_dec: ALUUnaryOp = (cpu, n) => {
  const result = n - 1;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    (result & 0x10) !== 0,
    cpu.getFlag(FLAG.C)
  );
  return result & 0xff;
};
export const alu_swap: ALUUnaryOp = (cpu, n) => {
  const result = ((n & 0xf) << 4) | ((n >>> 4) & 0xf);
  cpu.aluSetFlags((result & 0xff) === 0, false, false, false);
  return result & 0xff;
};
export const alu_rlc: ALUUnaryOp = (cpu, n) => {
  const oldBit = n & 0x80;
  const result = ((n << 1) & 0xff) | (oldBit >>> 7);
  cpu.aluSetFlags(result === 0, false, false, oldBit !== 0);
  return result;
};
export const alu_rl: ALUUnaryOp = (cpu, n) => {
  const carry = (cpu.registers[REGISTER.F] >> 4) & 1;

  const oldBit = n & 0x80;
  const result = ((n << 1) & 0xff) | carry;
  cpu.aluSetFlags(result === 0, false, false, oldBit !== 0);
  return result;
};
export const alu_rrc: ALUUnaryOp = (cpu, n) => {
  const oldBit = n & 0x01;
  const result = ((n >>> 1) & 0xff) | (oldBit << 7);
  cpu.aluSetFlags(result === 0, false, false, oldBit !== 0);
  return result;
};
export const alu_rr: ALUUnaryOp = (cpu, n) => {
  const carry = (cpu.registers[REGISTER.F] >> 4) & 1;

  const oldBit = n & 0x01;
  const result = ((n >>> 1) & 0xff) | (carry << 7);
  cpu.aluSetFlags(result === 0, false, false, oldBit !== 0);
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
    const result = n & bitMask & 0xff;
    return result;
  };

export const unary_ops = [
  alu_rlc,
  alu_rrc,
  alu_rl,
  alu_rr,
  alu_sla,
  alu_sra,
  alu_swap,
  alu_srl,
];
