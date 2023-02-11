import { CPU } from '../cpu';

export interface OpExec {
  (cpu: CPU, pc: number): void;
}
