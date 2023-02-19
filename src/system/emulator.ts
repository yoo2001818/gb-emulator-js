import { APU } from '../audio/apu';
import { readCartridgeInfo } from '../cartridge/info';
import { REGISTER } from '../cpu/constants';
import { CPU } from '../cpu/cpu';
import { LCD } from '../lcd/lcd';
import { MBC3 } from '../memory/mbc3';
import { MBC5 } from '../memory/mbc5';
import { MemoryBus } from '../memory/memoryBus';
import { RAM } from '../memory/ram';
import { drawCanvas } from './canvas';
import { GamepadController } from './gamepad';
import { Interrupter } from './interrupter';
import { SystemTimer } from './timer';

export class Emulator {
  cpu: CPU;
  interrupter: Interrupter;
  cartridge!: MBC3;
  lcd: LCD;
  timer: SystemTimer;
  gamepad: GamepadController;
  apu: APU;
  isRunning: boolean;
  isStepping: boolean;

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  debugTextElem: HTMLDivElement;

  constructor(canvas: HTMLCanvasElement) {
    this.cpu = new CPU(new RAM(1));
    this.interrupter = new Interrupter(this.cpu);
    this.lcd = new LCD(this.interrupter);
    this.timer = new SystemTimer(this.interrupter);
    this.gamepad = new GamepadController();
    this.apu = new APU();
    this.isRunning = false;
    this.isStepping = false;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.debugTextElem = document.createElement('div');
    document.body.appendChild(this.debugTextElem);
    this.debugTextElem.style.fontFamily = 'monospace';
  }

  async load(rom: Uint8Array) {
    // TODO: Read ROM data and provide proper bank controller
    const cartridgeInfo = await readCartridgeInfo(rom);
    console.log(cartridgeInfo);
    const cartridgeType = rom[0x147];
    switch (cartridgeType) {
      case 0x19:
      case 0x1a:
      case 0x1b:
      case 0x1c:
      case 0x1d:
      case 0x1e:
        // MBC5
        this.cartridge = new MBC5(rom, new Uint8Array(8192 * 4));
        break;
      case 0x11:
      case 0x12:
      case 0x13:
      default:
        // MBC3
        this.cartridge = new MBC3(rom, new Uint8Array(8192 * 4));
        break;
    }
    const memoryBus = new MemoryBus(
      this.cartridge,
      this.lcd,
      this.timer,
      this.gamepad,
      this.apu,
    );
    this.cpu.memory = memoryBus;
    memoryBus.cpu = this.cpu;
    this.reboot();
  }

  reboot() {
    this.lcd.reset();
    this.timer.reset();
    this.gamepad.reset();
    this.apu.reset();
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

  readStack(nBytes: number): string {
    const buffer = [];
    const sp = this.cpu.registers[REGISTER.SP]; 
    for (let i = 0; i < nBytes; i += 1) {
      buffer.push(this.cpu.memory.read(sp + i).toString(16).padStart(2, '00'));
    }
    return buffer.join(' ');
  }

  update() {
    if (!this.isRunning) return;
    // Generate Pin/Timer interrupt (and run CPU for random time)
  
    // Start LCD clock
    if (this.isStepping) {
      this.lcd.runVblank = true;
    } else {
      // this.lcd.runVblank = true;
      this.lcd.runVblank = false;
      this.lcd.resetClock();
    }

    // Run system until stopped
    // 4.194304MHz -> Around 70000 clocks per each frame
    let stopClock = this.cpu.clocks + 70224;
    // let stop_clock = this.cpu.clocks + 796976;
    // SRAM - 855528
    // let stop_clock = this.cpu.clocks + 861344;
    // let stop_clock = this.cpu.clocks + 797020;
    // let stop_clock = this.cpu.clocks + 797560;
    // stopClock = this.cpu.clocks + 501760;
    // stopClock = this.cpu.clocks + 1048600;
    // stopClock = this.cpu.clocks + 1056656;
    // stopClock = this.cpu.clocks + 37069345;
    // 866980
    if (this.isStepping) {
      stopClock = this.cpu.clocks + 4;
      this.isRunning = false;
      this.cpu.isTrapResolved = true;
      this.cpu.isTrapped = false;
    }
    while (this.cpu.clocks < stopClock && (this.cpu.isRunning || this.cpu.isInterruptsEnabled) && !this.cpu.isTrapped) {
      // Run CPU
      let beforeClock = this.cpu.clocks;
      this.interrupter.step();
      let elapsedClocks = this.cpu.clocks - beforeClock;
      if (elapsedClocks === 0) {
        // CPU is halted; try to retrive next interesting clock
        const skipClocks = Math.min(
          this.lcd.getNextWakeupClockAdvance() + 1,
          this.timer.getNextWakeupClockAdvance() + 1,
          // stopClock - this.cpu.clocks,
        );
        if (skipClocks === 0) break;
        elapsedClocks = skipClocks;
        this.cpu.clocks += skipClocks;
      }
      // Run I/O
      this.lcd.advanceClock(elapsedClocks);
      this.timer.advanceClock(elapsedClocks);
      this.apu.advanceClock(elapsedClocks);
    }
    if (this.isStepping) {
      console.log(this.lcd);
      console.log(this.cpu.clocks, this.cpu.getDebugState());
      console.log(this.cartridge.romBank, this.cartridge.ramBank);
      console.log(this.interrupter.getDebugState());

      const buffer = [];
      for (let i = this.cpu.registers[REGISTER.SP]; i <= 0xcfff; i += 1) {
        buffer.push(this.cpu.memory.read(i).toString(16));
      }
      console.log(buffer);
      console.log(this.apu.buffer);
    }
    this.debugTextElem.innerText = [
      `CLK: ${this.cpu.clocks}`,
      this.cpu.getDebugState(),
      this.interrupter.getDebugState(),
      this.lcd.getDebugState(),
      this.timer.getDebugState(),
      this.cartridge.getDebugState(),
      `Stack: ${this.readStack(20)}`,
      this.apu.getDebugState(),
    ].join('\n');
    // this.isRunning = false;

    // Render the screen, sound, etc
    drawCanvas(this.lcd, this.ctx);
    if (!this.isStepping) {
      this.apu.finalize();
    }
  }
}
