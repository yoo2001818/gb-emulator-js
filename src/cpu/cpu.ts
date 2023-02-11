import { FLAG, REGISTER, REGISTER_16 } from './register';

interface Memory {
  read(pos: number): number;
  write(pos: number, value: number): void;
}

export class CPU {
  registers: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  memory: Memory;
  isRunning = false;
  isInterruptsEnabled = false;
  isInterruptsEnabledNext = false;

  constructor(memory: Memory) {
    this.memory = memory;
  }

  readAF(): number {
    return this.registers[REGISTER.A] << 8 + this.registers[REGISTER.F];
  }

  writeAF(value: number): void {
    this.registers[REGISTER.A] = (value >>> 8) & 0xff;
    this.registers[REGISTER.F] = value & 0xff;
  }

  readBC(): number {
    return this.registers[REGISTER.B] << 8 + this.registers[REGISTER.C];
  }
  
  writeBC(value: number): void {
    this.registers[REGISTER.B] = (value >>> 8) & 0xff;
    this.registers[REGISTER.C] = value & 0xff;
  }

  readDE(): number {
    return this.registers[REGISTER.D] << 8 + this.registers[REGISTER.E];
  }

  writeDE(value: number): void {
    this.registers[REGISTER.D] = (value >>> 8) & 0xff;
    this.registers[REGISTER.E] = value & 0xff;
  }

  readHL(): number {
    return this.registers[REGISTER.H] << 8 + this.registers[REGISTER.L];
  }

  writeHL(value: number): void {
    this.registers[REGISTER.H] = (value >>> 8) & 0xff;
    this.registers[REGISTER.L] = value & 0xff;
  }

  readRegister16(id: number): number {
    switch (id) {
      case REGISTER_16.BC:
        return this.readBC();
      case REGISTER_16.DE:
        return this.readDE();
      case REGISTER_16.HL:
        return this.readHL();
      case REGISTER_16.SP:
        return this.registers[REGISTER.SP];
      case REGISTER_16.AF:
        return this.readAF();
      default:
        return 0;
    }
  }

  writeRegister16(id: number, value: number): void {
    switch (id) {
      case REGISTER_16.BC:
        this.writeBC(value);
        break;
      case REGISTER_16.DE:
        this.writeDE(value);
        break;
      case REGISTER_16.HL:
        this.writeHL(value);
        break;
      case REGISTER_16.SP:
        this.registers[REGISTER.SP] = value;
        break;
      case REGISTER_16.AF:
        this.writeAF(value);
        break;
      default:
        break;
    }
  }

  getFlag(flag: number): boolean {
    return (this.registers[REGISTER.F] << flag) !== 0;
  }

  aluSetFlags(z: boolean, n: boolean, h: boolean, c: boolean): void {
    let flags = this.registers[REGISTER.F] & 0xac;
    if (z) flags |= 1 << FLAG.Z;
    if (n) flags |= 1 << FLAG.N;
    if (h) flags |= 1 << FLAG.H;
    if (c) flags |= 1 << FLAG.C;
    this.registers[REGISTER.F] = flags;
  }

  aluAdd(a: number, b: number): number {
    const result = a + b;
    this.aluSetFlags(
      (result & 0xff) === 0,
      false,
      (result & 0x10) !== 0,
      (result & 0x100) !== 0,
    );
    return result & 0xff;
  }

  aluAdc(a: number, b: number): number {
    const carry = (this.registers[REGISTER.F] >> 4) & 1;
    const result = a + b + carry;
    this.aluSetFlags(
      (result & 0xff) === 0,
      false,
      (result & 0x10) !== 0,
      (result & 0x100) !== 0,
    );
    return result & 0xff;
  }

  aluSub(a: number, b: number): number {
    const result = a - b;
    this.aluSetFlags(
      (result & 0xff) === 0,
      true,
      (result & 0x10) !== 0,
      (result & 0x100) !== 0,
    );
    return result & 0xff;
  }

  aluSbc(a: number, b: number): number {
    const carry = (this.registers[REGISTER.F] >> 4) & 1;
    const result = a - b - carry;
    this.aluSetFlags(
      (result & 0xff) === 0,
      false,
      (result & 0x10) !== 0,
      (result & 0x100) !== 0,
    );
    return result & 0xff;
  }

  aluAnd(a: number, b: number): number {
    const result = a & b;
    this.aluSetFlags(
      (result & 0xff) === 0,
      false,
      true, 
      false,
    );
    return result & 0xff;
  }

  aluOr(a: number, b: number): number {
    const result = a | b;
    this.aluSetFlags(
      (result & 0xff) === 0,
      false,
      false, 
      false,
    );
    return result & 0xff;
  }

  aluXor(a: number, b: number): number {
    const result = a ^ b;
    this.aluSetFlags(
      (result & 0xff) === 0,
      false,
      false, 
      false,
    );
    return result & 0xff;
  }

  aluCp(a: number, b: number): number {
    const result = a - b;
    this.aluSetFlags(
      (result & 0xff) === 0,
      true,
      (result & 0x10) !== 0,
      (result & 0x100) !== 0,
    );
    return a;
  }

  skip(bytes: number): void {
    const pc = this.registers[REGISTER.PC];
    this.registers[REGISTER.PC] = (pc + bytes) & 0xffff;
  }

  step() {
    const iByte = this.memory.read(this.registers[REGISTER.PC]);
    const iUpper = (iByte >>> 4) & 0xf;
    const iLower = iByte & 0xf;
    switch (iUpper) {
      case 0x0:
      case 0x1:
      case 0x2:
      case 0x3:
        // 00~3F section
        switch (iLower) {
          case 0x0:
            // JR
            break;
          case 0x1:
            // LD n, nn
            break;
          case 0x2:
            // LD A, n
            break;
          case 0x3:
            // INC n
            break;
          case 0x4:
            // INC n
            break;
          case 0x5:
            // DEC n
            break;
          case 0x6:
            // LD n, nn
            break;
          case 0x7:
            // Miscallenous
            break;
          case 0x8:
            // JR
            break;
          case 0x9:
            // ADD HL, n
            break;
          case 0xA:
            // LD nn, A
            break;
          case 0xB:
            // DEC n
            break;
          case 0xC:
            // INC n
            break;
          case 0xD:
            // DEC n
            break;
          case 0xE:
            // LD n, nn
            break;
          case 0xF:
            // Miscallenous
            break;
        }
        break;
      case 0x4:
        // LD C, r2 or LD B, r2
        break;
      case 0x5:
        // LD E, r2 or LD D, r2
        break;
      case 0x6:
        // LD L, r2 or LD H, r2
        break;
      case 0x7:
        // LD A, r2 or LD (HL), r2
        break;
      case 0x8:
        // ADC A, n or ADD A, n
        break;
      case 0x9:
        // SBC A, n or SUB A, n
        break;
      case 0xa:
        // XOR A, n or AND A, n
        break;
      case 0xb:
        // CP A, n or OR A, n
        break;
      case 0xc:
      case 0xd:
      case 0xe:
      case 0xf:
        // C0~FF section
        switch (iLower) {
          case 0x0:
            // JR
            break;
          case 0x1:
            // LD n, nn
            break;
          case 0x2:
            // LD A, n
            break;
          case 0x3:
            // INC n
            break;
          case 0x4:
            // INC n
            break;
          case 0x5:
            // DEC n
            break;
          case 0x6:
            // LD n, nn
            break;
          case 0x7:
            // Miscallenous
            break;
          case 0x8:
            // JR
            break;
          case 0x9:
            // ADD HL, n
            break;
          case 0xA:
            // LD nn, A
            break;
          case 0xB:
            // DEC n
            break;
          case 0xC:
            // INC n
            break;
          case 0xD:
            // DEC n
            break;
          case 0xE:
            // LD n, nn
            break;
          case 0xF:
            // Miscallenous
            break;
        }
        break;
    }
  }
}
