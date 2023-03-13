export interface Memory {
  read(addr: number): number;
  write(addr: number, value: number): void;
}
