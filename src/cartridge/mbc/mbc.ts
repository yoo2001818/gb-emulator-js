import { Memory } from "../../memory/types";

export interface MemoryBankController extends Memory {
  ramUpdated: boolean;

  loadRAM(ram: Uint8Array): void;
  serializeRAM(): Uint8Array;

  getDebugState(): string;
  reset(): void;
}
