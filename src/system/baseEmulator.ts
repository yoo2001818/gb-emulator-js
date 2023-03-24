import { APU } from '../audio/apu';
import { Cartridge } from '../cartridge/cartridge';
import { LCD } from '../lcd/lcd';
import { RAM } from '../memory/ram';
import { WRAM } from '../memory/wram';
import { BaseSystem } from './baseSystem';
import { DMA } from './dma';
import { GamepadController } from './gamepad';
import { HDMA } from './hdma';
import { SpeedController } from './speedController';
import { SystemType } from './systemType';
import { SystemTimer } from './timer';

export class BaseEmulator {
  system: BaseSystem;
  ppu: LCD;
  apu: APU;
  timer: SystemTimer;
  gamepad: GamepadController;
  wram: WRAM;
  hram: RAM;
  dma: DMA;
  hdma: HDMA;
  speed: SpeedController;
  cartridge: Cartridge | null;

  constructor() {
    this.system = new BaseSystem();
    this.ppu = new LCD(this.system.interrupter);
    this.apu = new APU();
    this.timer = new SystemTimer(this.system.interrupter);
    this.gamepad = new GamepadController();
    this.wram = new WRAM();
    this.hram = new RAM(0x80);
    this.dma = new DMA();
    this.hdma = new HDMA();
    this.speed = new SpeedController();
    this.cartridge = null;
  }

  serialize(): any {
    return {
      ...this.system.serialize(),
      ppu: this.ppu.serialize(),
      apu: this.apu.serialize(),
      timer: this.timer.serialize(),
      wram: this.wram.serialize(),
      hram: this.hram.serialize(),
      dma: this.dma.serialize(),
      hdma: this.hdma.serialize(),
      speed: this.speed.serialize(),
      cartridge: this.cartridge!.mbc.serialize(),
    };
  }

  deserialize(data: any): void {
    this.system.deserialize(data);
    this.ppu.deserialize(data.ppu);
    this.apu.deserialize(data.apu);
    this.timer.deserialize(data.timer);
    this.wram.deserialize(data.wram);
    this.hram.deserialize(data.hram);
    this.dma.deserialize(data.dma);
    this.hdma.deserialize(data.hdma);
    this.speed.deserialize(data.speed);
    this.cartridge!.mbc.deserialize(data.cartridge);
  }

  reset(type?: SystemType): void {
    this.system.reset(type);
    this.wram.reset();
    this.hram.reset();
    this.ppu.reset();
    this.apu.reset();
    this.timer.reset();
    this.gamepad.reset();
    this.dma.reset();
    this.hdma.reset();
    this.speed.reset();
    if (this.cartridge != null) {
      this.cartridge.reset();
    }

    this.wram.register(this.system);
    this.ppu.register(this.system);
    this.apu.register(this.system);
    this.timer.register(this.system);
    this.gamepad.register(this.system);
    this.system.ioBus.registerMemory(0x80, 0x7f, 'HRAM', this.hram);
    this.dma.register(this.system);
    this.hdma.register(this.system);
    this.speed.register(this.system);
    if (this.cartridge != null) {
      this.cartridge.register(this.system);
    }

    this.system.cpu.onTick = this.advanceClocks.bind(this);

    // Start the CPU
    this.system.cpu.jump(0x100);
    this.system.cpu.isRunning = true;
  }

  advanceClocks(ticks: number): void {
    let clocks = this.system.cpu.clocks - ticks;
    for (let i = 0; i < ticks; i += 1) {
      // Triggered every machine cycles in double speed
      this.timer.advanceClock();
      this.dma.advanceClock();
      this.speed.advanceClock();
      // Triggered every twice machine cycles in double speed
      if (!this.speed.isDoubleSpeed || clocks % 2 === 0) {
        this.ppu.advanceClock();
        this.apu.advanceClock();
        this.hdma.advanceClock();
      }
      clocks += 1;
    }
  }
}
