import { CPU } from './cpu/cpu';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { Memory } from './memory/types';
import path from 'path';
import { createInterface } from 'readline';

function formatResultData(input: Uint8Array): string[] {
  const output: string[] = [];
  output.push(
    `PC: ${(input[8] | (input[9] << 8)).toString(16).padStart(4, '0')} ` +
      `SP: ${(input[10] | (input[11] << 8)).toString(16).padStart(4, '0')} ` +
      `A: ${input[0].toString(16).padStart(2, '0')} ` +
      `B: ${input[1].toString(16).padStart(2, '0')} ` +
      `C: ${input[2].toString(16).padStart(2, '0')} ` +
      `D: ${input[3].toString(16).padStart(2, '0')} ` +
      `E: ${input[4].toString(16).padStart(2, '0')} ` +
      `F: ${input[5].toString(16).padStart(2, '0')} ` +
      `H: ${input[6].toString(16).padStart(2, '0')} ` +
      `L: ${input[7].toString(16).padStart(2, '0')} ` +
      `Cycles: ${input[12]}`
  );
  for (let i = 16; i < input.length - 3; i += 4) {
    const addr = input[i] | (input[i + 1] << 8);
    const rw = input[i + 2];
    const value = input[i + 3];
    if (rw === 0) break;
    output.push(
      `${rw === 1 ? 'R' : 'W'} $${addr.toString(16).padStart(4, '0')}: ${value
        .toString(16)
        .padStart(2, '0')}`
    );
  }
  return output;
}

function testImpl(input: Uint8Array): { output: Buffer; line: string } {
  const output = Buffer.alloc(40);
  let readPos = 12;
  let writePos = 16;
  const memory: Memory = {
    read: (addr) => {
      const readValue = input[readPos];
      output[writePos] = addr & 0xff;
      output[writePos + 1] = (addr >> 8) & 0xff;
      output[writePos + 2] = 1;
      output[writePos + 3] = readValue;
      writePos += 4;
      readPos += 1;
      return readValue;
    },
    write: (addr, value) => {
      output[writePos] = addr & 0xff;
      output[writePos + 1] = (addr >> 8) & 0xff;
      output[writePos + 2] = 2;
      output[writePos + 3] = value;
      writePos += 4;
    },
  };
  const cpu = new CPU(memory);
  cpu.isDebugging = true;
  // Set up testing environment
  for (let i = 0; i < 8; i += 1) {
    cpu.registers[i] = input[i];
  }
  cpu.registers[8] = input[8] | (input[9] << 8);
  cpu.registers[9] = input[10] | (input[11] << 8);
  // Run test
  cpu.step();
  // Validate results
  for (let i = 0; i < 8; i += 1) {
    output[i] = cpu.registers[i];
  }
  output[8] = cpu.registers[8] & 0xff;
  output[9] = (cpu.registers[8] >>> 8) & 0xff;
  output[10] = cpu.registers[9] & 0xff;
  output[11] = (cpu.registers[9] >>> 8) & 0xff;
  output[12] = cpu.clocks;
  const debugLine = cpu.debugLogs[0];
  let line = '';
  if (debugLine != null) {
    line = `${debugLine.data} ${debugLine.comment}`;
  }
  return { output, line };
}

async function runTest(targetPath: string): Promise<void> {
  const child = spawn(targetPath);
  const rl = createInterface(child.stdout, undefined, undefined, false);
  let count = 0;
  while (true) {
    const input = crypto.randomBytes(16);
    child.stdin.write(input.toString('hex') + '\n');

    const { output: expected, line: expectedLine } = testImpl(input);
    const received = await new Promise<Buffer>((resolve) => {
      rl.once('line', (line) => {
        resolve(Buffer.from(line, 'hex'));
      });
    });

    if (!expected.equals(received)) {
      console.log(`Failed ${count} ===========`);
      console.log('Input:', input.toString('hex'));
      console.log('Expected:', expected.toString('hex'));
      console.log('Received:', received.toString('hex'));
      console.log('Instruction =========');
      console.log(expectedLine);
      console.log('Expected Breakdown ==========');
      console.log(formatResultData(expected).join('\n'));
      console.log('Received Breakdown ==========');
      console.log(formatResultData(received).join('\n'));
      break;
    } else {
      console.log(`Pass ${count}`);
    }
    count += 1;
  }
  child.kill('SIGKILL');
}

const targetName = process.argv[2];
if (targetName) {
  runTest(path.resolve(process.cwd(), targetName));
}
