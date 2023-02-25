import { APU } from '../audio/apu';
import { REGISTER } from '../cpu/constants';
import { CPU } from '../cpu/cpu';
import { LCD } from '../lcd/lcd';
import { MemoryBus } from '../memory/memoryBus';
import { RAM } from '../memory/ram';
import { drawCanvas } from './canvas';
import { GamepadController } from './gamepad';
import { Interrupter } from './interrupter';
import { SystemTimer } from './timer';
import { Cartridge, loadCartridge } from '../cartridge/cartridge';
import { readSaveStorage, writeSaveStorage } from '../storage/saveStorage';

export class Emulator {
  cpu: CPU;
  interrupter: Interrupter;
  cartridge: Cartridge | null;
  lcd: LCD;
  timer: SystemTimer;
  gamepad: GamepadController;
  apu: APU;
  isRunning: boolean;
  isStepping: boolean;

  sramSaveTimer: number = 0;

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  debugTextElem: HTMLDivElement;

  constructor(canvas: HTMLCanvasElement) {
    this.cpu = new CPU(new RAM(1));
    this.interrupter = new Interrupter(this.cpu);
    this.cartridge = null;
    this.lcd = new LCD(this.interrupter);
    this.timer = new SystemTimer(this.interrupter);
    this.gamepad = new GamepadController();
    this.apu = new APU();
    this.isRunning = false;
    this.isStepping = false;
    this.sramSaveTimer = 0;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.debugTextElem = document.createElement('div');
    document.body.appendChild(this.debugTextElem);
    this.debugTextElem.style.fontFamily = 'monospace';
  }

  async load(rom: Uint8Array) {
    const cart = await loadCartridge(rom);
    const saveData = await readSaveStorage(cart.info);
    if (saveData != null) {
      cart.mbc.loadRAM(saveData);
    }
    this.cartridge = cart;
    const memoryBus = new MemoryBus(
      cart.mbc,
      this.lcd,
      this.timer,
      this.gamepad,
      this.apu,
    );
    this.cpu.memory = memoryBus;
    memoryBus.cpu = this.cpu;
    this.reboot();
  }

  loadSRAMFromFile(ram: Uint8Array): void {
    const cart = this.cartridge;
    if (cart == null) return;
    cart.mbc.loadRAM(ram);
  }

  getSRAM(): Uint8Array | null {
    const cart = this.cartridge;
    if (cart == null) return null;
    return cart.mbc.serializeRAM();
  }

  async saveSRAM(): Promise<void> {
    const cart = this.cartridge;
    if (cart == null) return;
    const data = cart.mbc.serializeRAM();
    if (data == null) return;
    await writeSaveStorage(cart.info, data);
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
    this.sramSaveTimer = 0;
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
    if (this.cartridge == null) return;
  
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
    while (this.cpu.clocks < stopClock && (this.cpu.isRunning || this.interrupter.acceptsInterrupt()) && !this.cpu.isTrapped) {
      // Run CPU
      let beforeClock = this.cpu.clocks;
      this.interrupter.step();
      let elapsedClocks = this.cpu.clocks - beforeClock;
      if (elapsedClocks === 0) {
        // CPU is halted; try to retrive next interesting clock
        const skipClocks = Math.min(
          this.lcd.getNextWakeupClockAdvance(),
          this.timer.getNextWakeupClockAdvance(),
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
      this.cartridge.mbc.getDebugState(),
      `Stack: ${this.readStack(20)}`,
      this.apu.getDebugState(),
    ].join('\n');
    // this.isRunning = false;

    // Render the screen, sound, etc
    drawCanvas(this.lcd, this.ctx);
    if (!this.isStepping) {
      this.apu.finalize();
      // Save the RAM state if the SRAM has not been updated for 100 frames
      // (debounce)
      if (this.cartridge.mbc.ramUpdated) {
        this.sramSaveTimer = 100;
        this.cartridge.mbc.ramUpdated = false;
      }
      if (this.sramSaveTimer > 0) {
        this.sramSaveTimer -= 1;
        if (this.sramSaveTimer === 0) {
          this.saveSRAM();
        }
      }
    }
  }
}
