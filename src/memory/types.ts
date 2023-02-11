export interface Memory {
  read(pos: number): number;
  write(pos: number, value: number): void;
}
