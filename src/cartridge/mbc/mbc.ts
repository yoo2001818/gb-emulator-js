import { Memory } from "../../memory/types";

export interface MemoryBankController extends Memory {
  ramUpdated: boolean;

  loadRAM(ram: Uint8Array): void;
  serializeRAM(): Uint8Array | null;

  serialize(): any;
  deserialize(data: any): void;

  getDebugState(): string;
  reset(): void;
}
