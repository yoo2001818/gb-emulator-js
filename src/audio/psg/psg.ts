import { Memory } from "../../memory/types";

export interface PSG extends Memory {
  enabled: boolean;
  output: number;
  reset(): void;
  serialize(): any;
  deserialize(data: any): void;
  trigger(): void;
  step(clocks: number): void;
  getDebugState(): string;
}

export interface PSGModule extends Memory {
  reset(): void;
  serialize(): any;
  deserialize(data: any): void;
  trigger(): void;
  getNextClocks(clocks: number): number;
  step(clocks: number): void;
}
