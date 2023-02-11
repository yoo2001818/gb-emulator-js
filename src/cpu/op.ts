import { CPU } from './cpu';
import { generateLUTRules } from './lut';
import { FLAG, REGISTER, Register, REGISTER_16 } from './register';

export interface OpExec {
  (cpu: CPU, pc: number): void;
}

export const INSTRUCTIONS: OpExec[] = [];

const nop: OpExec = (cpu) => {
  cpu.registers[REGISTER.PC] += 1;
};

const ld = (r1: Register8Description, r2: Register8Description): OpExec => (cpu) => {
  const value = r2.read(cpu);
  r1.write(cpu, value);
  cpu.skip(1);
};

const ld_r_d8 = (r: Register8Description): OpExec => (cpu, pc) => {
  const value = cpu.memory.read(pc + 1);
  r.write(cpu, value);
  cpu.skip(2);
};

const ld_a_a16: OpExec = (cpu, pc) => {
  const addr = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  const nn = cpu.memory.read(addr);
  cpu.registers[REGISTER.A] = nn;
  cpu.skip(3);
};

const ld_a16_a: OpExec = (cpu, pc) => {
  const addr = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  cpu.memory.write(addr, cpu.registers[REGISTER.A]);
  cpu.skip(3);
};

const ld_a_c: OpExec = (cpu) => {
  const addr = (0xff00 + cpu.registers[REGISTER.C]) & 0xffff;
  const nn = cpu.memory.read(addr);
  cpu.registers[REGISTER.A] = nn;
  cpu.skip(1);
};

const ld_c_a: OpExec = (cpu) => {
  const addr = (0xff00 + cpu.registers[REGISTER.C]) & 0xffff;
  cpu.memory.write(addr, cpu.registers[REGISTER.A]);
  cpu.skip(1);
};

const ld_a_r16 = (r2: Register16Description): OpExec => (cpu) => {
  const addr = r2.read(cpu);
  const nn = cpu.memory.read(addr);
  cpu.registers[REGISTER.A] = nn;
  cpu.skip(1);
  r2.postCallback(cpu);
};

const ld_r16_a = (r1: Register16Description): OpExec => (cpu) => {
  const addr = r1.read(cpu);
  cpu.memory.write(addr, cpu.registers[REGISTER.A]);
  cpu.skip(1);
  r1.postCallback(cpu);
};

const ldh_a8_a: OpExec = (cpu, pc) => {
  const addr = (0xff00 + cpu.memory.read(pc + 1)) & 0xffff;
  cpu.memory.write(addr, cpu.registers[REGISTER.A]);
  cpu.skip(2);
};

const ldh_a_a8: OpExec = (cpu, pc) => {
  const addr = (0xff00 + cpu.memory.read(pc + 1)) & 0xffff;
  const nn = cpu.memory.read(addr);
  cpu.registers[REGISTER.A] = nn;
  cpu.skip(2);
};

const ld16_r_d16 = (r: Register16Description): OpExec => (cpu, pc) => {
  const nn = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  r.write(cpu, nn);
  cpu.skip(3);
  r.postCallback(cpu);
};

const ld16_a16_sp: OpExec = (cpu, pc) => {
  const addr = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  const value = cpu.registers[REGISTER.SP];
  cpu.memory.write(addr, value & 0xff);
  cpu.memory.write(addr + 1, (value << 8) & 0xff);
  cpu.skip(3);
};

const ld16_sp_hl: OpExec = (cpu) => {
  cpu.registers[REGISTER.SP] = cpu.readHL();
  cpu.registers[REGISTER.PC] += 1;
};
const ld16_hl_spr8: OpExec = (cpu, pc) => {
  const nn = cpu.registers[REGISTER.SP] + cpu.memory.read(pc + 1);
  cpu.writeHL(nn);
  cpu.registers[REGISTER.PC] += 2;
};

const push = (r: Register16Description): OpExec => (cpu) => {
  const value = r.read(cpu);
  const sp = cpu.registers[REGISTER.SP];
  cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
  cpu.memory.write(sp - 2, value & 0xff);
  cpu.registers[REGISTER.SP] -= 2;
  cpu.skip(1);
  r.postCallback(cpu);
};

const pop = (r: Register16Description): OpExec => (cpu) => {
  const sp = cpu.registers[REGISTER.SP];
  const value = cpu.memory.read(sp) | (cpu.memory.read(sp + 1) << 8);
  r.write(cpu, value);
  cpu.registers[REGISTER.SP] += 2;
  cpu.skip(1);
  r.postCallback(cpu);
};

type ALUUnaryOp = (cpu: CPU, a: number) => number;
type ALUBinaryOp = (cpu: CPU, a: number, b: number) => number;

const alu_add: ALUBinaryOp = (cpu, a, b) => cpu.aluAdd(a, b);
const alu_adc: ALUBinaryOp = (cpu, a, b) => cpu.aluAdc(a, b);
const alu_sub: ALUBinaryOp = (cpu, a, b) => cpu.aluSub(a, b);
const alu_sbc: ALUBinaryOp = (cpu, a, b) => cpu.aluSbc(a, b);
const alu_and: ALUBinaryOp = (cpu, a, b) => cpu.aluAnd(a, b);
const alu_or: ALUBinaryOp = (cpu, a, b) => cpu.aluOr(a, b);
const alu_xor: ALUBinaryOp = (cpu, a, b) => cpu.aluXor(a, b);
const alu_cp: ALUBinaryOp = (cpu, a, b) => cpu.aluCp(a, b);

const binary_ops = [
  alu_add,
  alu_adc,
  alu_sub,
  alu_sbc,
  alu_and,
  alu_or,
  alu_xor,
  alu_cp,
];

const alu_binary = (op: ALUBinaryOp, r2: Register8Description): OpExec => (cpu) => {
  const n1 = cpu.registers[REGISTER.A];
  const n2 = r2.read(cpu);
  cpu.registers[REGISTER.A] = op(cpu, n1, n2);
  cpu.skip(1);
};

const alu_binary_imm = (op: ALUBinaryOp): OpExec => (cpu, pc) => {
  const n1 = cpu.registers[REGISTER.A];
  const n2 = cpu.memory.read(pc + 1);
  cpu.registers[REGISTER.A] = op(cpu, n1, n2);
  cpu.skip(2);
};

const alu_unary = (op: ALUUnaryOp, r: Register8Description): OpExec => (cpu) => {
  const n = r.read(cpu);
  r.write(cpu, op(cpu, n));
  cpu.skip(1);
};

const alu_inc: ALUUnaryOp = (cpu, n) => {
  const result = n + 1;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    (result & 0x10) !== 0,
    cpu.getFlag(FLAG.C),
  );
  return result & 0xff;
};
const alu_dec: ALUUnaryOp = (cpu, n) => {
  const result = n - 1;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    (result & 0x10) !== 0,
    cpu.getFlag(FLAG.C),
  );
  return result & 0xff;
};
const alu_swap: ALUUnaryOp = (cpu, n) => {
  const result = ((n & 0xf) << 4) | ((n >>> 4) & 0xf);
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    false,
    false,
  );
  return result & 0xff;
};
const alu_rlc: ALUUnaryOp = (cpu, n) => {
  const oldBit = n & 0x80;
  const result = ((n << 1) & 0xff) | (oldBit >>> 7);
  cpu.aluSetFlags(
    result === 0,
    false,
    false,
    oldBit !== 0,
  );
  return result;
};
const alu_rl: ALUUnaryOp = (cpu, n) => {
  const carry = (cpu.registers[REGISTER.F] >> 4) & 1;

  const oldBit = n & 0x80;
  const result = ((n << 1) & 0xff) | carry;
  cpu.aluSetFlags(
    result === 0,
    false,
    false,
    oldBit !== 0,
  );
  return result;
};
const alu_rrc: ALUUnaryOp = (cpu, n) => {
  const oldBit = n & 0x01;
  const result = ((n >>> 1) & 0xff) | (oldBit << 7);
  cpu.aluSetFlags(
    result === 0,
    false,
    false,
    oldBit !== 0,
  );
  return result;
};
const alu_rr: ALUUnaryOp = (cpu, n) => {
  const carry = (cpu.registers[REGISTER.F] >> 4) & 1;

  const oldBit = n & 0x01;
  const result = ((n >>> 1) & 0xff) | (carry << 7);
  cpu.aluSetFlags(
    result === 0,
    false,
    false,
    oldBit !== 0,
  );
  return result;
};
const alu_sla: ALUUnaryOp = (cpu, n) => {
  const oldBit = n & 0x80;
  const result = (n << 1) & 0xff;
  cpu.aluSetFlags(
    result === 0,
    false,
    false,
    oldBit !== 0,
  );
  return result;
};
const alu_sra: ALUUnaryOp = (cpu, n) => {
  const oldBit = n & 0x01;
  const result = ((n >>> 1) & 0xff) | (n & 0x80);
  cpu.aluSetFlags(
    result === 0,
    false,
    false,
    oldBit !== 0,
  );
  return result;
};
const alu_srl: ALUUnaryOp = (cpu, n) => {
  const oldBit = n & 0x01;
  const result = (n >>> 1) & 0xff;
  cpu.aluSetFlags(
    result === 0,
    false,
    false,
    oldBit !== 0,
  );
  return result;
};
const alu_bit = (bit: number): ALUUnaryOp => (cpu, n) => {
  const bitMask = 1 << bit;
  const result = (bitMask & n) & 0xff;
  cpu.aluSetFlags(
    result === 0,
    false,
    true,
    cpu.getFlag(FLAG.C),
  );
  return n;
};
const alu_set = (bit: number): ALUUnaryOp => (cpu, n) => {
  const bitMask = 1 << bit;
  const result = (bitMask | n) & 0xff;
  return result;
};
const alu_res = (bit: number): ALUUnaryOp => (cpu, n) => {
  const bitMask = ~(1 << bit);
  const result = n & bitMask & 0xff;
  return result;
};

const unary_ops = [
  alu_rlc,
  alu_rrc,
  alu_rl,
  alu_rr,
  alu_sla,
  alu_sra,
  alu_swap,
  alu_srl,
];

const add16 = (r1: Register16Description, r2: Register16Description): OpExec => (cpu, pc) => {
  const n1 = r1.read(cpu);
  const n2 = r2.read(cpu);
  const result = n1 + n2;
  cpu.aluSetFlags(
    cpu.getFlag(FLAG.Z),
    false,
    (result & 0x1000) !== 0,
    (result & 0x10000) !== 0,
  );
  r1.write(cpu, result & 0xffff);
  cpu.skip(1);
  r1.postCallback(cpu);
  r2.postCallback(cpu);
};

const add16_sp_n: OpExec = (cpu, pc) => {
  const n1 = cpu.registers[REGISTER.SP];
  const n2 = cpu.memory.read(pc + 1);
  const result = n1 + n2;
  cpu.registers[REGISTER.SP] = result & 0xffff;
  cpu.skip(2);
};

const inc16 = (r: Register16Description): OpExec => (cpu) => {
  const n1 = r.read(cpu);
  const result = n1 + 1;
  r.write(cpu, result & 0xffff);
  cpu.skip(1);
  r.postCallback(cpu);
};

const dec16 = (r: Register16Description): OpExec => (cpu) => {
  const n1 = r.read(cpu);
  const result = n1 - 1;
  r.write(cpu, result & 0xffff);
  cpu.skip(1);
  r.postCallback(cpu);
};

const daa: OpExec = (cpu) => {
  let value = cpu.registers[REGISTER.A];
  if (cpu.getFlag(FLAG.H) || (value & 0x0f) > 9) {
    value += 0x06;
  }
  let carry = false;
  if (cpu.getFlag(FLAG.C) || (value & 0xf0) > 9) {
    carry = true;
    value += 0x60;
  }
  cpu.aluSetFlags(
    (value & 0xff) === 0,
    cpu.getFlag(FLAG.N),
    false,
    carry,
  );
  cpu.registers[REGISTER.A] = value & 0xff;
  cpu.skip(1);
};

const cpl: OpExec = (cpu) => {
  const result = (~cpu.registers[REGISTER.A]) & 0xff;
  cpu.aluSetFlags(
    cpu.getFlag(FLAG.Z),
    false,
    false,
    cpu.getFlag(FLAG.C),
  );
  cpu.registers[REGISTER.A] = result;
  cpu.skip(1);
};

const ccf: OpExec = (cpu) => {
  cpu.aluSetFlags(
    cpu.getFlag(FLAG.Z),
    false,
    false,
    !cpu.getFlag(FLAG.C),
  );
  cpu.skip(1);
};

const scf: OpExec = (cpu) => {
  cpu.aluSetFlags(
    cpu.getFlag(FLAG.Z),
    false,
    false,
    true,
  );
  cpu.skip(1);
};

const halt: OpExec = (cpu) => {
  cpu.isRunning = false;
  cpu.skip(1);
};

const stop: OpExec = (cpu) => {
  // TODO: Wait for button press
  cpu.isRunning = false;
  cpu.skip(2);
};

const di: OpExec = (cpu) => {
  cpu.isInterruptsEnabledNext = false;
  cpu.skip(1);
};

const ei: OpExec = (cpu) => {
  cpu.isInterruptsEnabledNext = true;
  cpu.skip(1);
};

const jp_a16: OpExec = (cpu, pc) => {
  const nn = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  cpu.registers[REGISTER.PC] = nn;
};

const jp_cond_a16 = (cond: (cpu: CPU) => boolean): OpExec => (cpu, pc) => {
  if (cond(cpu)) {
    const nn = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
    cpu.registers[REGISTER.PC] = nn;
  } else {
    cpu.registers[REGISTER.PC] += 1;
  }
};

const jp_hl: OpExec = (cpu, pc) => {
  const nn = cpu.readHL();
  cpu.registers[REGISTER.PC] = nn;
};

const jr_r8: OpExec = (cpu, pc) => {
  let n = cpu.memory.read(pc + 1);
  if (n & 0x80) {
    n = -(((~n) + 1) & 0xff);
  }
  cpu.registers[REGISTER.PC] += n;
};

const jr_cond_r8 = (cond: (cpu: CPU) => boolean): OpExec => (cpu, pc) => {
  if (cond(cpu)) {
    let n = cpu.memory.read(pc + 1);
    if (n & 0x80) {
      n = -(((~n) + 1) & 0xff);
    }
    cpu.registers[REGISTER.PC] += n;
  } else {
    cpu.registers[REGISTER.PC] += 2;
  }
};

const call_a16: OpExec = (cpu, pc) => {
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

const call_cond_a16 = (cond: (cpu: CPU) => boolean): OpExec => (cpu, pc) => {
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

const rst_nn = (n: number): OpExec => (cpu, pc) => {
  // push
  const value = pc + 2;
  const sp = cpu.registers[REGISTER.SP];
  cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
  cpu.memory.write(sp - 2, value & 0xff);
  cpu.registers[REGISTER.SP] -= 2;
  // jmp
  cpu.registers[REGISTER.PC] = n;
};

const ret: OpExec = (cpu, pc) => {
  // pop
  const sp = cpu.registers[REGISTER.SP];
  const value = cpu.memory.read(sp) | (cpu.memory.read(sp + 1) << 8);
  cpu.registers[REGISTER.SP] += 2;
  // jmp
  cpu.registers[REGISTER.PC] = value;
};

const ret_cond = (cond: (cpu: CPU) => boolean): OpExec => (cpu, pc) => {
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

const reti: OpExec = (cpu, pc) => {
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

interface ConditionDescription {
  (cpu: CPU): boolean;
}

const conds: ConditionDescription[] = [
  (cpu) => !cpu.getFlag(FLAG.Z), // nz
  (cpu) => cpu.getFlag(FLAG.Z), // z
  (cpu) => !cpu.getFlag(FLAG.C), // nc
  (cpu) => cpu.getFlag(FLAG.C), //c
];

interface Register8Description {
  read(cpu: CPU): number;
  write(cpu: CPU, value: number): void;
}

const r8_simple = (register_id: Register): Register8Description => ({
  read: (cpu) => cpu.registers[register_id],
  write: (cpu, value) => {
    cpu.registers[register_id] = value;
  },
});

const r8_hl: Register8Description = {
  read: (cpu) => cpu.memory.read(cpu.readHL()),
  write: (cpu, value) => cpu.memory.write(cpu.readHL(), value),
};

const r8_a = r8_simple(REGISTER.A);

const r8s: Register8Description[] = [
  r8_simple(REGISTER.B),
  r8_simple(REGISTER.C),
  r8_simple(REGISTER.D),
  r8_simple(REGISTER.E),
  r8_simple(REGISTER.H),
  r8_simple(REGISTER.L),
  r8_hl,
  r8_a,
];

interface Register16Description {
  read(cpu: CPU): number;
  write(cpu: CPU, value: number): void;
  postCallback(cpu: CPU): void;
}

const r16_simple = (register_id: Register): Register16Description => ({
  read: (cpu) => cpu.readRegister16(register_id),
  write: (cpu, value) => {
    cpu.writeRegister16(register_id, value);
  },
  postCallback: () => {},
});

const r16_hl = r16_simple(REGISTER_16.HL);

const r16_hl_inc: Register16Description = {
  ...r16_hl,
  postCallback: (cpu) => {
    cpu.writeHL((cpu.readHL() + 1) & 0xffff);
  },
};

const r16_hl_dec: Register16Description = {
  ...r16_hl,
  postCallback: (cpu) => {
    cpu.writeHL((cpu.readHL() - 1) & 0xffff);
  },
}

const r16s_1: Register16Description[] = [
  r16_simple(REGISTER_16.BC),
  r16_simple(REGISTER_16.DE),
  r16_simple(REGISTER_16.HL),
  r16_simple(REGISTER_16.SP),
];

const r16s_2: Register16Description[] = [
  r16_simple(REGISTER_16.BC),
  r16_simple(REGISTER_16.DE),
  r16_hl_dec,
  r16_hl_inc,
];

const r16s_3: Register16Description[] = [
  r16_simple(REGISTER_16.BC),
  r16_simple(REGISTER_16.DE),
  r16_simple(REGISTER_16.HL),
  r16_simple(REGISTER_16.AF),
];

function setupInstructions() {
  generateLUTRules(256, [
    ['00000000', () => nop],
    ['00001000', () => ld16_a16_sp], // ld16 (a16), SP
    ['00010000', () => stop],
    ['00011000', () => jr_r8], // jr r8
    ['001cc000', ({ c }) => jr_cond_r8(conds[c])], // jr c, r8
    // BC, DE, HL, SP
    ['00RR0001', ({ R }) => ld16_r_d16(r16s_1[R])], // ld16 r, d16
    ['00RR1001', ({ R }) => add16(r16_hl, r16s_1[R])], // add16 hl, r
    ['00RR0011', ({ R }) => inc16(r16s_1[R])], // inc16 R
    ['00RR1011', ({ R }) => dec16(r16s_1[R])], // dec16 R
    // BC, DE, HL+, HL-
    ['00RR0010', ({ R }) => ld_r16_a(r16s_2[R])], // ld16 (r), a
    ['00RR1010', ({ R }) => ld_a_r16(r16s_2[R])], // ld16 a, (r)
    ['00rrr100', ({ r }) => alu_unary(alu_inc, r8s[r])], // inc r
    ['00rrr101', ({ r }) => alu_unary(alu_dec, r8s[r])], // dec r
    ['00rrr110', ({ r }) => ld_r_d8(r8s[r])], // ld r, d8
    ['00000111', () => alu_unary(alu_rlc, r8_a)], // rlca
    ['00001111', () => alu_unary(alu_rrc, r8_a)], // rrca
    ['00010111', () => alu_unary(alu_rl, r8_a)], // rla
    ['00011111', () => alu_unary(alu_rr, r8_a)], // rra
    ['00100111', () => daa],
    ['00101111', () => cpl],
    ['00110111', () => scf],
    ['00111111', () => ccf],
    ['01aaabbb', ({ a, b }) => ld(r8s[a], r8s[b])], // ld a, b
    ['01110110', () => halt],
    ['10ooorrr', ({ o, r }) => alu_binary(binary_ops[o], r8s[r])], // (binary_op) a, r
    ['110cc000', ({ c }) => ret_cond(conds[c])], // ret c
    ['110cc010', ({ c }) => jp_cond_a16(conds[c])], // jp c, a16
    ['110cc100', ({ c }) => call_cond_a16(conds[c])], // call c, a16
    ['11000011', () => jp_a16],
    ['11001001', () => ret],
    ['11011001', () => reti],
    ['11001011', () => /* PREFIX */],
    ['11001101', () => call_a16], // call a16
    // BC, DE, HL, AF
    ['11DD0001', ({ D }) => pop(r16s_3[D])], // pop D
    ['11DD0101', ({ D }) => push(r16s_3[D])], // push D 
    ['11ooo110', ({ o }) => alu_binary_imm(binary_ops[o])], // (binary_op) a, d8
    ['11nnn111', ({ n }) => rst_nn(n << 3)], // rst nn
    ['11100000', () => ldh_a8_a], // ldh (a8), a
    ['11110000', () => ldh_a_a8], // ldh a, (a8)
    ['11100010', () => ld_c_a], // ld (c), a
    ['11110010', () => ld_a_c], // ld a, (c)
    ['11101000', () => add16_sp_n], // add sp, r8 
    ['11111000', () => ld16_hl_spr8], // ld hl, sp + r8
    ['11101001', () => jp_hl], // jp hl
    ['11111001', () => ld16_sp_hl], // ld sp, hl
    ['11101010', () => ld_a16_a], // ld (a16), a
    ['11111010', () => ld_a_a16], // ld a, (a16)
    ['11110011', () => di],
    ['11111011', () => ei],
  ]);
  // Prefixed
  generateLUTRules(256, [
    ['00ooorrr', ({ o, r }) => alu_unary(unary_ops[o], r8s[r])], // (unary_op) r
    ['01nnnrrr', ({ n, r }) => alu_unary(alu_bit(n), r8s[r])], // bit n, r
    ['10nnnrrr', ({ n, r }) => alu_unary(alu_res(n), r8s[r])], // res n, r
    ['11nnnrrr', ({ n, r }) => alu_unary(alu_set(n), r8s[r])], // set n, r
  ]);
}
setupInstructions();
