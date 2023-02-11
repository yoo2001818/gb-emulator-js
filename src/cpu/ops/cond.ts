import { CPU } from '../cpu';
import { FLAG } from '../register';

export interface ConditionDescription {
  (cpu: CPU): boolean;
}

export const conds: ConditionDescription[] = [
  (cpu) => !cpu.getFlag(FLAG.Z), // nz
  (cpu) => cpu.getFlag(FLAG.Z), // z
  (cpu) => !cpu.getFlag(FLAG.C), // nc
  (cpu) => cpu.getFlag(FLAG.C), //c
];
