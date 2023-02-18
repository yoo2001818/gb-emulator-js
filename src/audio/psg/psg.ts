import { Memory } from "../../memory/types";

export interface PSG extends Memory {
  output: number;
  reset(): void;
  step(clocks: number): void;
  getDebugState(): string;
}
