import { CPU } from '../cpu/cpu';

export const INTERRUPT_TYPES = {
  VBLANK: 0,
  LCDC: 1,
  TIMER_OVERFLOW: 2,
  SERIAL_COMPLETE: 3,
  PIN_TRIGGERED: 4,
};

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
    let if_reg = memory.read(IF_ADDR);
    if_reg |= 1 << type;
    memory.write(IF_ADDR, if_reg);
    if (this.cpu.isInterruptsEnabled) {
      this.cpu.isRunning = true;
    }
  }

  step(): void {
    if (this.cpu.isInterruptsEnabled) {
      const memory = this.cpu.memory;
      // Check if an interrupt should occur
      const if_reg = memory.read(IF_ADDR);
      const ie_reg = memory.read(IE_ADDR);
      let interrupt_reg = ie_reg & if_reg;
      if (interrupt_reg) {
        // Check which type is generated 
        let interrupt_type = 0;
        while ((interrupt_reg & 1) === 0) {
          interrupt_type += 1;
          interrupt_reg = interrupt_reg >>> 1;
        }
        // Clear IF register of the type
        memory.write(IF_ADDR, if_reg & ~(1 << interrupt_type));
        // Generate interrupts
        this.cpu.enterInterrupt();
        this.cpu.jump(0x40 + (interrupt_type << 8));
      }
    }
    this.cpu.step();
  }
}
