import { CPU } from '../cpu';
import { REGISTER, Register } from '../constants';

export interface Register8Description {
  read(cpu: CPU): number;
  write(cpu: CPU, value: number): void;
}

export const r8_simple = (register_id: Register): Register8Description => ({
  read: (cpu) => cpu.registers[register_id],
  write: (cpu, value) => {
    cpu.registers[register_id] = value;
  },
});

export const r8_hl: Register8Description = {
  read: (cpu) => cpu.memory.read(cpu.readHL()),
  write: (cpu, value) => cpu.memory.write(cpu.readHL(), value),
};

export const r8_a = r8_simple(REGISTER.A);

export const r8s: Register8Description[] = [
  r8_simple(REGISTER.B),
  r8_simple(REGISTER.C),
  r8_simple(REGISTER.D),
  r8_simple(REGISTER.E),
  r8_simple(REGISTER.H),
  r8_simple(REGISTER.L),
  r8_hl,
  r8_a,
];

export interface Register16Description {
  read(cpu: CPU): number;
  write(cpu: CPU, value: number): void;
  postCallback(cpu: CPU): void;
}

export const r16_af: Register16Description = {
  read: (cpu) => cpu.registers[REGISTER.A] << (8 + cpu.registers[REGISTER.F]),
  write: (cpu, value) => {
    cpu.registers[REGISTER.A] = (value >>> 8) & 0xff;
    cpu.registers[REGISTER.F] = value & 0xff;
  },
  postCallback: () => {},
};

export const r16_bc: Register16Description = {
  read: (cpu) => cpu.registers[REGISTER.B] << (8 + cpu.registers[REGISTER.C]),
  write: (cpu, value) => {
    cpu.registers[REGISTER.B] = (value >>> 8) & 0xff;
    cpu.registers[REGISTER.C] = value & 0xff;
  },
  postCallback: () => {},
};

export const r16_de: Register16Description = {
  read: (cpu) => cpu.registers[REGISTER.D] << (8 + cpu.registers[REGISTER.E]),
  write: (cpu, value) => {
    cpu.registers[REGISTER.D] = (value >>> 8) & 0xff;
    cpu.registers[REGISTER.E] = value & 0xff;
  },
  postCallback: () => {},
};

export const r16_sp: Register16Description = {
  read: (cpu) => cpu.registers[REGISTER.SP],
  write: (cpu, value) => {
    cpu.registers[REGISTER.SP] = value;
  },
  postCallback: () => {},
};

export const r16_hl: Register16Description = {
  read: (cpu) => cpu.readHL(),
  write: (cpu, value) => cpu.writeHL(value),
  postCallback: () => {},
};

export const r16_hl_inc: Register16Description = {
  ...r16_hl,
  postCallback: (cpu) => {
    cpu.writeHL((cpu.readHL() + 1) & 0xffff);
  },
};

export const r16_hl_dec: Register16Description = {
  ...r16_hl,
  postCallback: (cpu) => {
    cpu.writeHL((cpu.readHL() - 1) & 0xffff);
  },
};

export const r16s_1: Register16Description[] = [r16_bc, r16_de, r16_hl, r16_sp];

export const r16s_2: Register16Description[] = [
  r16_bc,
  r16_de,
  r16_hl_dec,
  r16_hl_inc,
];

export const r16s_3: Register16Description[] = [r16_bc, r16_de, r16_hl, r16_af];
