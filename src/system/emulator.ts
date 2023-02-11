import { CPU } from '../cpu/cpu';
import { MBC3 } from '../memory/mbc3';
import { MemoryBus } from '../memory/memoryBus';
import { RAM } from '../memory/ram';
import { Interrupter, INTERRUPT_TYPES } from './interrupter';

export class Emulator {
  cpu: CPU;
  interrupter: Interrupter;
  isRunning: boolean;

  constructor() {
    this.cpu = new CPU(new RAM(1));
    this.interrupter = new Interrupter(this.cpu);
    this.isRunning = false;
  }

  load(rom: Uint8Array) {
    // TODO: Read ROM data and provide proper bank controller
    this.cpu.memory = new MemoryBus(
      new MBC3(rom, new Uint8Array(4096)),
    );
    this.reboot();
  }

  reboot() {
    this.cpu.reboot();
    // Assume that we have continued through the bootloader
    this.cpu.jump(0x100);
    this.cpu.isRunning = true;
  }

  start() {
    this.isRunning = true;
  }

  stop() {
    this.isRunning = false;
  }

  update() {
    if (!this.isRunning) return;
    // Generate Pin/Timer interrupt (and run CPU for random time)

    // Generate VBLANK interrupt
    this.interrupter.queueInterrupt(INTERRUPT_TYPES.VBLANK);

    // Run CPU until stopped
    const FORCE_STOP_THRESHOLD = 100;
    let stop_counter = FORCE_STOP_THRESHOLD;
    while (stop_counter > 0 && this.cpu.isRunning) {
      this.interrupter.step();
      stop_counter -= 1;
      // console.log(this.cpu.getDebugState());
    }

    // Render the screen, sound, etc
  }
}
