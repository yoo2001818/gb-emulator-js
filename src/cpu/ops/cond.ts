import { CPU } from '../cpu';
import { FLAG } from '../constants';

export interface ConditionDescription {
  (cpu: CPU): boolean;
  name: string;
}

export const conds: ConditionDescription[] = [
  function nz(cpu) { return !cpu.getFlag(FLAG.Z); }, // nz
  function z(cpu) { return cpu.getFlag(FLAG.Z); }, // z
  function nc(cpu) { return !cpu.getFlag(FLAG.C); }, // nc
  function c(cpu) { return cpu.getFlag(FLAG.C); }, //c
];
