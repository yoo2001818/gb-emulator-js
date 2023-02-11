import { CPU } from '../cpu/cpu';
import { LCD, LCD_HEIGHT, LCD_WIDTH } from '../lcd/lcd';
import { MBC3 } from '../memory/mbc3';
import { MemoryBus } from '../memory/memoryBus';
import { RAM } from '../memory/ram';
import { Interrupter } from './interrupter';
import { SystemTimer } from './timer';

export class Emulator {
  cpu: CPU;
  interrupter: Interrupter;
  cartridge!: MBC3;
  lcd: LCD;
  timer: SystemTimer;
  isRunning: boolean;
  isStepping: boolean;

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.cpu = new CPU(new RAM(1));
    this.interrupter = new Interrupter(this.cpu);
    this.lcd = new LCD(this.interrupter);
    this.timer = new SystemTimer(this.interrupter);
    this.isRunning = false;
    this.isStepping = false;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  load(rom: Uint8Array) {
    // TODO: Read ROM data and provide proper bank controller
    this.cartridge = new MBC3(rom, new Uint8Array(8192 * 4));
    const memoryBus = new MemoryBus(
      this.cartridge,
      this.lcd,
      this.timer,
    );
    this.cpu.memory = memoryBus;
    memoryBus.cpu = this.cpu;
    this.reboot();
  }

  reboot() {
    this.lcd.reset();
    this.timer.reset();
    this.cpu.reset();
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
  
    // Start LCD clock
    if (this.isStepping) {
      this.lcd.runVblank = true;
    } else {
      this.lcd.runVblank = false;
      this.lcd.resetClock();
    }

    // Run system until stopped
    // 4.194304MHz -> Around 70000 clocks per each frame
    let stop_clock = this.cpu.clocks + 70000;
    // let stop_clock = this.cpu.clocks + 796976;
    // SRAM - 855528
    // let stop_clock = this.cpu.clocks + 861344;
    // let stop_clock = this.cpu.clocks + 797020;
    // let stop_clock = this.cpu.clocks + 797560;
    if (this.isStepping) {
      stop_clock = this.cpu.clocks + 4;
      this.isRunning = false;
    }
    while (this.cpu.clocks < stop_clock && (this.cpu.isRunning || this.cpu.isInterruptsEnabled)) {
      // Run CPU
      let beforeClock = this.cpu.clocks;
      this.interrupter.step();
      let elapsedClocks = this.cpu.clocks - beforeClock;
      if (elapsedClocks === 0) {
        // CPU is halted; try to retrive next interesting clock
        const skipClocks = Math.min(
          this.lcd.getNextWakeupClockAdvance(),
          this.timer.getNextWakeupClockAdvance(),
          stop_clock - this.cpu.clocks,
        );
        elapsedClocks = skipClocks;
        this.cpu.clocks += skipClocks;
      }
      // Run I/O
      this.lcd.advanceClock(elapsedClocks);
      this.timer.advanceClock(elapsedClocks);
    }
    if (this.isStepping) {
      console.log(this.lcd);
      console.log(this.cpu.clocks, this.cpu.getDebugState());
      console.log(this.cartridge.romBank, this.cartridge.ramBank);
      console.log(this.interrupter.getDebugState());

      /*
      const buffer = [];
      for (let i = 0xff80; i <= 0xffff; i += 1) {
        buffer.push(this.cpu.memory.read(i).toString(16));
      }
      console.log(buffer);
      */
    }
    // this.isRunning = false;

    // Render the screen, sound, etc
    const imageData = new ImageData(this.lcd.outputBitmap, LCD_WIDTH, LCD_HEIGHT);
    this.ctx.putImageData(imageData, 0, 0);
  }
}
