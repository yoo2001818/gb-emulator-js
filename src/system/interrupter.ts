import { REGISTER } from '../cpu/constants';
import { CPU } from '../cpu/cpu';
import { getHex16 } from '../cpu/ops/utils';

export const INTERRUPT_TYPE = {
  VBLANK: 0,
  LCDC: 1,
  TIMER_OVERFLOW: 2,
  SERIAL_COMPLETE: 3,
  PIN_TRIGGERED: 4,
};

const INTERRUPT_NAMES = [
  'V-blank',
  'LCDC',
  'Timer overflow',
  'Serial complete',
  'Pin triggered',
];

const IE_ADDR = 0xFFFF;
const IF_ADDR = 0xFF0F;

export class Interrupter {
  cpu: CPU;

  constructor(cpu: CPU) {
    this.cpu = cpu;
  }

  queueInterrupt(type: number): void {
    const memory = this.cpu.memory;
    // Set up IF
    let ifReg = memory.read(IF_ADDR);
    ifReg |= 1 << type;
    memory.write(IF_ADDR, ifReg);
  }

  acceptsInterrupt(): boolean {
    const memory = this.cpu.memory;
    const ieReg = memory.read(IE_ADDR);
    return (ieReg & 0x1f) !== 0;
  }

  getDebugState(): string {
    const memory = this.cpu.memory;
    const ifReg = memory.read(IF_ADDR);
    const ieReg = memory.read(IE_ADDR);
    return [
      `IME: ${this.cpu.isInterruptsEnabled}`,
      `IF: ${ifReg.toString(16)} IE: ${ieReg.toString(16)}`,
    ].join('\n');
  }

  step(): void {
    if (this.cpu.isInterruptsEnabled || !this.cpu.isRunning) {
      const memory = this.cpu.memory;
      // Check if an interrupt should occur
      const ifReg = memory.read(IF_ADDR);
      const ieReg = memory.read(IE_ADDR);
      let interruptReg = ieReg & ifReg;
      if (interruptReg) {
        // Check which type is generated 
        let interruptType = 0;
        while ((interruptReg & 1) === 0) {
          interruptType += 1;
          interruptReg = interruptReg >>> 1;
        }
        // Regardless of IME flag, start the CPU (continuing from HALT)
        this.cpu.isRunning = true;
        if (this.cpu.isInterruptsEnabled) {
          // Clear IF register of the type
          memory.write(IF_ADDR, ifReg & ~(1 << interruptType));
          // Generate interrupts
          const prevPc = this.cpu.registers[REGISTER.PC];
          this.cpu.enterInterrupt();
          const addr = 0x40 + (interruptType * 8);
          this.cpu.jump(addr);
          if (this.cpu.isDebugging) {
            this.cpu.log(
              'event',
              `Interrupt ${interruptType} (${INTERRUPT_NAMES[interruptType]})`,
              undefined,
              `pc=${getHex16(addr)} (was ${getHex16(prevPc)}) sp=${getHex16(this.cpu.registers[REGISTER.SP])}`,
            );
          }
        } else {
          if (this.cpu.isDebugging) {
            this.cpu.log('event', `Interrupt resume ${interruptType} (${INTERRUPT_NAMES[interruptType]})`);
          }
        }
      }
    }
    if (this.cpu.isRunning) {
      this.cpu.step();
    }
  }
}
