import { CPU } from '../cpu';
import { REGISTER, Register, REGISTER_16 } from '../register';

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

export const r16_simple = (register_id: Register): Register16Description => ({
  read: (cpu) => cpu.readRegister16(register_id),
  write: (cpu, value) => {
    cpu.writeRegister16(register_id, value);
  },
  postCallback: () => {},
});

export const r16_hl = r16_simple(REGISTER_16.HL);

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
}

export const r16s_1: Register16Description[] = [
  r16_simple(REGISTER_16.BC),
  r16_simple(REGISTER_16.DE),
  r16_simple(REGISTER_16.HL),
  r16_simple(REGISTER_16.SP),
];

export const r16s_2: Register16Description[] = [
  r16_simple(REGISTER_16.BC),
  r16_simple(REGISTER_16.DE),
  r16_hl_dec,
  r16_hl_inc,
];

export const r16s_3: Register16Description[] = [
  r16_simple(REGISTER_16.BC),
  r16_simple(REGISTER_16.DE),
  r16_simple(REGISTER_16.HL),
  r16_simple(REGISTER_16.AF),
];
