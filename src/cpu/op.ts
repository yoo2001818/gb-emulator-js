import { CPU } from './cpu';
import { FLAG, REGISTER, Register } from './register';

export interface OpExec {
  (cpu: CPU, pc: number): void;
}

export const INSTRUCTIONS: OpExec[] = [];

const nop: OpExec = (cpu) => {
  cpu.registers[REGISTER.PC] += 1;
};

const ld8nn = (n: Register): OpExec => (cpu, pc) => {
  const nn = cpu.memory.read(pc + 1);
  cpu.registers[n] = nn;
  cpu.registers[REGISTER.PC] += 2;
}

const ld8 = (r1: Register, r2: Register): OpExec => (cpu) => {
  cpu.registers[r1] = cpu.registers[r2];
  cpu.registers[REGISTER.PC] += 1;
};

const ld8FromHL = (r1: Register): OpExec => (cpu) => {
  const nn = cpu.memory.read(cpu.readHL());
  cpu.registers[r1] = nn;
  cpu.registers[REGISTER.PC] += 1;
};

const ld8ToHL = (r2: Register): OpExec => (cpu) => {
  cpu.memory.write(cpu.readHL(), cpu.registers[r2]);
  cpu.registers[REGISTER.PC] += 1;
};

const ld8FromIndirect = (r1: Register, r2: Register): OpExec => (cpu) => {
  const nn = cpu.memory.read(cpu.readRegister16(r2));
  cpu.registers[r1] = nn;
  cpu.registers[REGISTER.PC] += 1;
};

const ld8ToIndirect = (r1: Register, r2: Register): OpExec => (cpu) => {
  cpu.memory.write(cpu.readRegister16(r1), r2);
  cpu.registers[REGISTER.PC] += 1;
};

const ld8FromAddress = (r1: Register): OpExec => (cpu, pc) => {
  const addr = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  const nn = cpu.memory.read(addr);
  cpu.registers[r1] = nn;
  cpu.registers[REGISTER.PC] += 3;
};

const ld8ToAddress = (r2: Register): OpExec => (cpu, pc) => {
  const addr = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  cpu.memory.write(addr, cpu.registers[r2]);
  cpu.registers[REGISTER.PC] += 3;
};

const ld8FromC = (r1: Register): OpExec => (cpu, pc) => {
  const addr = 0xff00 + cpu.registers[REGISTER.C];
  const nn = cpu.memory.read(addr);
  cpu.registers[r1] = nn;
  cpu.registers[REGISTER.PC] += 1;
};

const ld8ToC = (r2: Register): OpExec => (cpu, pc) => {
  const addr = 0xff00 + cpu.registers[REGISTER.C];
  cpu.memory.write(addr, cpu.registers[r2]);
  cpu.registers[REGISTER.PC] += 1;
};

const lddAHL: OpExec = (cpu, pc) => {
  const hl = cpu.readHL();
  cpu.registers[REGISTER.A] = cpu.memory.read(hl);
  cpu.writeHL((hl - 1) & 0xffff);
  cpu.registers[REGISTER.PC] += 1;
};
const lddHLA: OpExec = (cpu, pc) => {
  const hl = cpu.readHL();
  cpu.memory.write(hl, cpu.registers[REGISTER.A]);
  cpu.writeHL((hl - 1) & 0xffff);
  cpu.registers[REGISTER.PC] += 1;
};
const ldiAHL: OpExec = (cpu, pc) => {
  const hl = cpu.readHL();
  cpu.registers[REGISTER.A] = cpu.memory.read(hl);
  cpu.writeHL((hl + 1) & 0xffff);
  cpu.registers[REGISTER.PC] += 1;
};
const ldiHLA: OpExec = (cpu, pc) => {
  const hl = cpu.readHL();
  cpu.memory.write(hl, cpu.registers[REGISTER.A]);
  cpu.writeHL((hl + 1) & 0xffff);
  cpu.registers[REGISTER.PC] += 1;
};

const ldhNA: OpExec = (cpu, pc) => {
  const addr = 0xff00 + cpu.memory.read(pc + 1);
  cpu.memory.write(addr, cpu.registers[REGISTER.A]);
  cpu.registers[REGISTER.PC] += 2;
};

const ldhAN: OpExec = (cpu, pc) => {
  const addr = 0xff00 + cpu.memory.read(pc + 1);
  const nn = cpu.memory.read(addr);
  cpu.registers[REGISTER.A] = nn;
  cpu.registers[REGISTER.PC] += 2;
};

const ld16nn = (n: Register): OpExec => (cpu, pc) => {
  const nn = cpu.memory.read(pc + 1) | (cpu.memory.read(pc + 2) << 8);
  cpu.writeRegister16(n, nn);
  cpu.registers[REGISTER.PC] += 3;
};
const ld16SPHL: OpExec = (cpu) => {
  cpu.registers[REGISTER.SP] = cpu.readHL();
  cpu.registers[REGISTER.PC] += 1;
};
const ldhl16SPN: OpExec = (cpu, pc) => {
  const nn = cpu.registers[REGISTER.SP] + cpu.memory.read(pc + 1);
  cpu.writeHL(nn);
  cpu.registers[REGISTER.PC] += 2;
};

const push = (n: Register): OpExec => (cpu) => {
  const value = cpu.readRegister16(n);
  const sp = cpu.registers[REGISTER.SP];
  cpu.memory.write(sp - 1, (value >>> 8) & 0xff);
  cpu.memory.write(sp - 2, value & 0xff);
  cpu.registers[REGISTER.SP] -= 2;
  cpu.registers[REGISTER.PC] += 1;
};

const pop = (n: Register): OpExec => (cpu) => {
  const sp = cpu.registers[REGISTER.SP];
  const value = cpu.memory.read(sp) | (cpu.memory.read(sp + 1) << 8);
  cpu.writeRegister16(n, value);
  cpu.registers[REGISTER.SP] += 2;
  cpu.registers[REGISTER.PC] += 1;
};

type ALUUnaryOp = (cpu: CPU, a: number) => number;
type ALUBinaryOp = (cpu: CPU, a: number, b: number) => number;

const aluBinaryN = (op: ALUBinaryOp, r2: Register): OpExec => (cpu) => {
  const n1 = cpu.registers[REGISTER.A];
  const n2 = cpu.registers[r2];
  cpu.registers[REGISTER.A] = op(cpu, n1, n2);
  cpu.registers[REGISTER.PC] += 1;
}

const aluBinaryHL = (op: ALUBinaryOp, r2: Register): OpExec => (cpu) => {
  const n1 = cpu.registers[REGISTER.A];
  const n2 = cpu.memory.read(cpu.readHL());
  cpu.registers[REGISTER.A] = op(cpu, n1, n2);
  cpu.registers[REGISTER.PC] += 1;
}

const aluBinaryImm = (op: ALUBinaryOp, r2: Register): OpExec => (cpu, pc) => {
  const n1 = cpu.registers[REGISTER.A];
  const n2 = cpu.memory.read(pc + 1);
  cpu.registers[REGISTER.A] = op(cpu, n1, n2);
  cpu.registers[REGISTER.PC] += 2;
}

const aluUnaryN = (op: ALUUnaryOp, r1: Register): OpExec => (cpu) => {
  const n1 = cpu.registers[r1];
  cpu.registers[r1] = op(cpu, n1);
  cpu.registers[REGISTER.PC] += 1;
}

const aluUnaryHL = (op: ALUUnaryOp, r1: Register): OpExec => (cpu) => {
  const hl = cpu.readHL();
  const n1 = cpu.memory.read(hl);
  cpu.memory.write(hl, op(cpu, n1));
  cpu.registers[REGISTER.PC] += 1;
}

const aluOpAdd: ALUBinaryOp = (cpu, a, b) => cpu.aluAdd(a, b);
const aluOpAdc: ALUBinaryOp = (cpu, a, b) => cpu.aluAdc(a, b);
const aluOpSub: ALUBinaryOp = (cpu, a, b) => cpu.aluSub(a, b);
const aluOpSbc: ALUBinaryOp = (cpu, a, b) => cpu.aluSbc(a, b);
const aluOpAnd: ALUBinaryOp = (cpu, a, b) => cpu.aluAnd(a, b);
const aluOpOr: ALUBinaryOp = (cpu, a, b) => cpu.aluOr(a, b);
const aluOpXor: ALUBinaryOp = (cpu, a, b) => cpu.aluXor(a, b);
const aluOpCp: ALUBinaryOp = (cpu, a, b) => cpu.aluCp(a, b);
const aluOpInc: ALUUnaryOp = (cpu, n) => {
  const result = n + 1;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    (result & 0x10) !== 0,
    cpu.getFlag(FLAG.C),
  );
  return result & 0xff;
};
const aluOpDec: ALUUnaryOp = (cpu, n) => {
  const result = n - 1;
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    (result & 0x10) !== 0,
    cpu.getFlag(FLAG.C),
  );
  return result & 0xff;
};
const aluOpSwap: ALUUnaryOp = (cpu, n) => {
  const result = ((n & 0xf) << 4) | ((n >>> 4) & 0xf);
  cpu.aluSetFlags(
    (result & 0xff) === 0,
    false,
    false,
    false,
  );
  return result & 0xff;
};
const aluOpRlc: ALUUnaryOp = (cpu, n) => {
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
const aluOpRl: ALUUnaryOp = (cpu, n) => {
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
const aluOpRrc: ALUUnaryOp = (cpu, n) => {
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
const aluOpRr: ALUUnaryOp = (cpu, n) => {
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
const aluOpSla: ALUUnaryOp = (cpu, n) => {
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
const aluOpSra: ALUUnaryOp = (cpu, n) => {
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
const aluOpSrl: ALUUnaryOp = (cpu, n) => {
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

const add16HLN = (r2: Register): OpExec => (cpu, pc) => {
  const n1 = cpu.readHL();
  const n2 = cpu.readRegister16(r2);
  const result = n1 + n2;
  cpu.aluSetFlags(
    cpu.getFlag(FLAG.Z),
    false,
    (result & 0x1000) !== 0,
    (result & 0x10000) !== 0,
  );
  cpu.writeHL(result & 0xffff);
  cpu.registers[REGISTER.PC] += 1;
};

const add16SPN: OpExec = (cpu, pc) => {
  const n1 = cpu.registers[REGISTER.SP];
  const n2 = cpu.memory.read(pc + 1);
  const result = n1 + n2;
  cpu.registers[REGISTER.SP] = result & 0xffff;
  cpu.registers[REGISTER.PC] += 2;
};

const inc16 = (r1: Register): OpExec => (cpu, pc) => {
  const n1 = cpu.readRegister16(r1);
  const result = n1 + 1;
  cpu.writeRegister16(r1, result & 0xffff);
  cpu.registers[REGISTER.PC] += 1;
};

const dec16 = (r1: Register): OpExec => (cpu, pc) => {
  const n1 = cpu.readRegister16(r1);
  const result = n1 + 1;
  cpu.writeRegister16(r1, result & 0xffff);
  cpu.registers[REGISTER.PC] += 1;
};

const daa: OpExec = (cpu) => {
  let value = cpu.registers[REGISTER.A];
  if (cpu.getFlag(FLAG.H) || (value & 0xf0) > 9) {
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
  cpu.registers[REGISTER.PC] += 1;
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
  cpu.registers[REGISTER.PC] += 1;
};

const ccf: OpExec = (cpu) => {
  cpu.aluSetFlags(
    cpu.getFlag(FLAG.Z),
    false,
    false,
    !cpu.getFlag(FLAG.C),
  );
  cpu.registers[REGISTER.PC] += 1;
};

const scf: OpExec = (cpu) => {
  cpu.aluSetFlags(
    cpu.getFlag(FLAG.Z),
    false,
    false,
    true,
  );
  cpu.registers[REGISTER.PC] += 1;
};

const halt: OpExec = (cpu) => {
  cpu.isRunning = false;
  cpu.registers[REGISTER.PC] += 1;
};

const stop: OpExec = (cpu) => {
  // TODO: Wait for button press
  cpu.isRunning = false;
  cpu.registers[REGISTER.PC] += 1;
};

const di: OpExec = (cpu) => {
  cpu.isInterruptsEnabledNext = false;
  cpu.registers[REGISTER.PC] += 1;
};

const ei: OpExec = (cpu) => {
  cpu.isInterruptsEnabledNext = true;
  cpu.registers[REGISTER.PC] += 1;
};

function setupInstructions() {
  INSTRUCTIONS[0] = nop
}
setupInstructions();
