import { generateLUTRules } from '../lut';
import { OpExec } from './types';
import { REGISTER } from '../constants';
import {
  alu_binary,
  alu_binary_imm,
  alu_bit,
  alu_dec,
  alu_inc,
  alu_res,
  alu_rl,
  alu_rlc,
  alu_rr,
  alu_rrc,
  alu_set,
  alu_unary,
  alu_unary_read,
  binary_ops,
  unary_ops,
} from './alu';
import { conds } from './cond';
import {
  call_a16,
  call_cond_a16,
  jp_a16,
  jp_cond_a16,
  jp_hl,
  jr_cond_r8,
  jr_r8,
  ret,
  reti,
  ret_cond,
  rst_nn,
} from './jmp';
import {
  ld,
  ld16_a16_sp,
  ld16_hl_spr8,
  ld16_r_d16,
  ld16_sp_hl,
  ldh_a8_a,
  ldh_a_a8,
  ld_a16_a,
  ld_a_a16,
  ld_a_c,
  ld_a_r16,
  ld_c_a,
  ld_r16_a,
  ld_r_d8,
} from './ld';
import {
  add16,
  add16_sp_n,
  ccf,
  cpl,
  daa,
  dec16,
  di,
  ei,
  halt,
  inc16,
  nop,
  pop,
  push,
  scf,
  stop,
} from './misc';
import { r16s_1, r16s_2, r16s_3, r16_hl, r8s, r8_a } from './register';

const prefix_opcodes = generateLUTRules(256, [
  ['00ooorrr', ({ o, r }) => alu_unary(unary_ops[o], r8s[r], 8)], // (unary_op) r
  ['01nnnrrr', ({ n, r }) => alu_unary_read(alu_bit(n), r8s[r], 8)], // bit n, r
  ['10nnnrrr', ({ n, r }) => alu_unary(alu_res(n), r8s[r], 8)], // res n, r
  ['11nnnrrr', ({ n, r }) => alu_unary(alu_set(n), r8s[r], 8)], // set n, r
]);

const read_prefix: OpExec = (cpu, pc) => {
  cpu.registers[REGISTER.PC] += 1;
  const next = cpu.memory.read(pc + 1);
  prefix_opcodes[next](cpu, pc + 1);
};

export const main_opcodes = generateLUTRules(256, [
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
  ['00rrr100', ({ r }) => alu_unary(alu_inc, r8s[r], 4)], // inc r
  ['00rrr101', ({ r }) => alu_unary(alu_dec, r8s[r], 4)], // dec r
  ['00rrr110', ({ r }) => ld_r_d8(r8s[r])], // ld r, d8
  ['00000111', () => alu_unary(alu_rlc(false), r8_a, 4)], // rlca
  ['00001111', () => alu_unary(alu_rrc(false), r8_a, 4)], // rrca
  ['00010111', () => alu_unary(alu_rl(false), r8_a, 4)], // rla
  ['00011111', () => alu_unary(alu_rr(false), r8_a, 4)], // rra
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
  ['11001011', () => read_prefix],
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
