import fs from 'fs';
import path from 'path';
import { CPU } from './cpu';

describe('CPU', () => {
  it('should run opcodes', () => {
    const memory: Uint8Array = new Uint8Array(64);
    const cpu_test = fs.readFileSync(
      path.resolve(__dirname, '../../res/cpuTest.bin')
    );
    memory.set(cpu_test);
    const cpu = new CPU({
      read: (addr) => memory[addr],
      write: (addr, value) => (memory[addr] = value),
    });
    cpu.runUntilHalt();
    expect(memory[0]).toBe(0);
    expect(memory[1]).toBe(0x22);
    expect(memory[2]).toBe(0x28);
    expect(memory[3]).toBe(0);
  });
});
