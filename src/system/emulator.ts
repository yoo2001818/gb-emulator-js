import { REGISTER } from '../cpu/constants';
import { drawCanvas } from './canvas';
import { loadCartridge } from '../cartridge/cartridge';
import { readSaveStorage, writeSaveStorage } from '../storage/saveStorage';
import { getHex16 } from '../cpu/ops/utils';
import { BaseEmulator } from './baseEmulator';
import { getSystemType, SystemType } from './systemType';

export class Emulator {
  emulator: BaseEmulator;
  isRunning: boolean;
  isStepping: boolean;

  sramSaveTimer: number = 0;

  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  debugTextElem: HTMLDivElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.emulator = new BaseEmulator();
    this.isRunning = false;
    this.isStepping = false;
    this.sramSaveTimer = 0;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  async load(rom: Uint8Array) {
    const cart = await loadCartridge(this.emulator.system.cpu, rom);
    const saveData = await readSaveStorage(cart.info);
    if (saveData != null) {
      cart.mbc.loadRAM(saveData);
    }
    this.emulator.cartridge = cart;
    this.reboot(getSystemType(cart.info));
  }

  loadSRAMFromFile(ram: Uint8Array): void {
    const cart = this.emulator.cartridge;
    if (cart == null) return;
    cart.mbc.loadRAM(ram);
  }

  getSRAM(): Uint8Array | null {
    const cart = this.emulator.cartridge;
    if (cart == null) return null;
    return cart.mbc.serializeRAM();
  }

  async saveSRAM(): Promise<void> {
    const cart = this.emulator.cartridge;
    if (cart == null) return;
    const data = cart.mbc.serializeRAM();
    if (data == null) return;
    await writeSaveStorage(cart.info, data);
  }

  serialize(): any {
    return this.emulator.serialize();
  }

  deserialize(data: any): void {
    this.emulator.deserialize(data);
  }

  reboot(type?: SystemType) {
    this.emulator.reset(type);
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
    const sp = this.emulator.system.cpu.registers[REGISTER.SP];
    for (let i = 0; i < nBytes; i += 1) {
      buffer.push(this.emulator.system.cpu.memory.read(sp + i).toString(16).padStart(2, '00'));
    }
    return buffer.join(' ');
  }

  update() {
    if (!this.isRunning) return;
    if (this.emulator.cartridge == null) return;

    const { ppu, timer, apu, cartridge, speed } = this.emulator;
    const { cpu, interrupter } = this.emulator.system;

    // Start LCD clock
    if (this.isStepping) {
      cpu.isDebugging = true;
      cpu.debugLogs = [];
    } else {
      cpu.isDebugging = false;
    }

    // Run system until stopped
    // 4.194304MHz -> Around 70224 clocks per each frame (17556 M-clocks)
    let runClocks = this.emulator.ppu.getRemainingClockUntilVblank();
    if (speed.isDoubleSpeed) runClocks *= 2;
    let stopClock = cpu.clocks + runClocks;
    if (this.isStepping) {
      stopClock = cpu.clocks + 1;
      this.isRunning = false;
      cpu.isTrapResolved = true;
      cpu.isTrapped = false;
    }
    while (cpu.clocks < stopClock && (cpu.isRunning || interrupter.acceptsInterrupt()) && !cpu.isTrapped) {
      // Run CPU
      let beforeClock = cpu.clocks;
      interrupter.step();
      let elapsedClocks = cpu.clocks - beforeClock;
      if (elapsedClocks === 0) {
        // CPU is halted; try to retrive next interesting clock
        const skipClocks = Math.min(
          ppu.getNextWakeupClockAdvance(),
          timer.getNextWakeupClockAdvance(),
          // stopClock - this.cpu.clocks,
        );
        if (skipClocks === 0) break;
        elapsedClocks = skipClocks;
        if (speed.isDoubleSpeed) elapsedClocks *= 2;
        cpu.tick(elapsedClocks);
      }
    }
    if (this.isStepping) {
      for (const log of cpu.debugLogs) {
        if (log.address != null) {
          console.log('%c%s: %c%s; %c%s', 'color: #468cff', getHex16(log.address), 'color: inherit', log.data, 'color: gray', log.comment ?? '');
        } else {
          console.log(log.data, log.comment ?? '');
        }
      }
      cpu.debugLogs = [];
    }
    if (this.debugTextElem != null) {
      this.debugTextElem.innerText = [
        '--------- CPU',
        `CLK: ${cpu.clocks}`,
        cpu.getDebugState(),
        interrupter.getDebugState(),
        '--------- PPU',
        ppu.getDebugState(),
        '--------- TIMER',
        timer.getDebugState(),
        '--------- CART',
        `Cartridge: ${cartridge.info.title}`,
        cartridge.mbc.getDebugState(),
        '--------- APU',
        apu.getDebugState(),
        '--------- STACK',
        `Stack: ${this.readStack(20)}`,
      ].join('\n');
    }
    // this.isRunning = false;

    // Render the screen, sound, etc
    drawCanvas(ppu, this.ctx);
    if (!this.isStepping) {
      apu.finalize();
      // Save the RAM state if the SRAM has not been updated for 100 frames
      // (debounce)
      if (cartridge.mbc.ramUpdated) {
        this.sramSaveTimer = 100;
        cartridge.mbc.ramUpdated = false;
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
