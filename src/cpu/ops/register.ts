import { CPU } from '../cpu';
import { REGISTER, Register } from '../constants';

export interface Register8Description {
  name: string;
  read(cpu: CPU): number;
  write(cpu: CPU, value: number): void;
  clocks: number;
}

export const r8_simple = (register_id: Register, name: string): Register8Description => ({
  name,
  read: (cpu) => cpu.registers[register_id],
  write: (cpu, value) => {
    cpu.registers[register_id] = value;
  },
  clocks: 0,
});

export const r8_hl: Register8Description = {
  name: '(hl)',
  read: (cpu) => cpu.memory.read(cpu.readHL()),
  write: (cpu, value) => cpu.memory.write(cpu.readHL(), value),
  clocks: 1,
};

export const r8_a = r8_simple(REGISTER.A, 'a');

export const r8s: Register8Description[] = [
  r8_simple(REGISTER.B, 'b'),
  r8_simple(REGISTER.C, 'c'),
  r8_simple(REGISTER.D, 'd'),
  r8_simple(REGISTER.E, 'e'),
  r8_simple(REGISTER.H, 'h'),
  r8_simple(REGISTER.L, 'l'),
  r8_hl,
  r8_a,
];

export interface Register16Description {
  name: string;
  read(cpu: CPU): number;
  write(cpu: CPU, value: number): void;
  postCallback(cpu: CPU): void;
}

export const r16_af: Register16Description = {
  name: 'af',
  read: (cpu) => (cpu.registers[REGISTER.A] << 8) | cpu.registers[REGISTER.F],
  write: (cpu, value) => {
    cpu.registers[REGISTER.A] = (value >>> 8) & 0xff;
    cpu.registers[REGISTER.F] = value & 0xff;
  },
  postCallback: () => {},
};

export const r16_bc: Register16Description = {
  name: 'bc',
  read: (cpu) => (cpu.registers[REGISTER.B] << 8) | cpu.registers[REGISTER.C],
  write: (cpu, value) => {
    cpu.registers[REGISTER.B] = (value >>> 8) & 0xff;
    cpu.registers[REGISTER.C] = value & 0xff;
  },
  postCallback: () => {},
};

export const r16_de: Register16Description = {
  name: 'de',
  read: (cpu) => (cpu.registers[REGISTER.D] << 8) | cpu.registers[REGISTER.E],
  write: (cpu, value) => {
    cpu.registers[REGISTER.D] = (value >>> 8) & 0xff;
    cpu.registers[REGISTER.E] = value & 0xff;
  },
  postCallback: () => {},
};

export const r16_sp: Register16Description = {
  name: 'sp',
  read: (cpu) => cpu.registers[REGISTER.SP],
  write: (cpu, value) => {
    cpu.registers[REGISTER.SP] = value;
  },
  postCallback: () => {},
};

export const r16_hl: Register16Description = {
  name: 'hl',
  read: (cpu) => cpu.readHL(),
  write: (cpu, value) => cpu.writeHL(value),
  postCallback: () => {},
};

export const r16_hl_inc: Register16Description = {
  ...r16_hl,
  name: 'hl+',
  postCallback: (cpu) => {
    cpu.writeHL((cpu.readHL() + 1) & 0xffff);
  },
};

export const r16_hl_dec: Register16Description = {
  ...r16_hl,
  name: 'hl-',
  postCallback: (cpu) => {
    cpu.writeHL((cpu.readHL() - 1) & 0xffff);
  },
};

export const r16s_1: Register16Description[] = [r16_bc, r16_de, r16_hl, r16_sp];

export const r16s_2: Register16Description[] = [
  r16_bc,
  r16_de,
  r16_hl_inc,
  r16_hl_dec,
];

export const r16s_3: Register16Description[] = [r16_bc, r16_de, r16_hl, r16_af];
