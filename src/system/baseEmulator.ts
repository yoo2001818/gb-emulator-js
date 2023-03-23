import { APU } from '../audio/apu';
import { Cartridge } from '../cartridge/cartridge';
import { LCD } from '../lcd/lcd';
import { RAM } from '../memory/ram';
import { WRAM } from '../memory/wram';
import { BaseSystem } from './baseSystem';
import { DMA } from './dma';
import { GamepadController } from './gamepad';
import { HDMA } from './hdma';
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
    this.cartridge = null;
  }

  serialize(): any {
    return {
      cpu: this.system.cpu.serialize(),
      interrupter: this.system.interrupter.serialize(),
      ppu: this.ppu.serialize(),
      apu: this.apu.serialize(),
      timer: this.timer.serialize(),
      wram: this.wram.serialize(),
      hram: this.hram.serialize(),
      dma: this.dma.serialize(),
      hdma: this.hdma.serialize(),
      cartridge: this.cartridge!.mbc.serialize(),
    };
  }

  deserialize(data: any): void {
    this.system.cpu.deserialize(data.cpu);
    this.system.interrupter.deserialize(data.interrupter);
    this.ppu.deserialize(data.ppu);
    this.apu.deserialize(data.apu);
    this.timer.deserialize(data.timer);
    this.wram.deserialize(data.wram);
    this.hram.deserialize(data.hram);
    this.dma.deserialize(data.dma);
    this.hdma.deserialize(data.hdma);
    this.cartridge!.mbc.deserialize(data.cartridge);
  }

  reset(): void {
    this.system.reset();
    this.wram.reset();
    this.hram.reset();
    this.ppu.reset();
    this.apu.reset();
    this.timer.reset();
    this.gamepad.reset();
    this.dma.reset();
    this.hdma.reset();
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
    if (this.cartridge != null) {
      this.cartridge.register(this.system);
    }

    this.system.cpu.onTick = this.advanceClocks.bind(this);
  }

  advanceClocks(ticks: number): void {
    for (let i = 0; i < ticks; i += 1) {
      this.ppu.advanceClock();
      this.apu.advanceClock();
      this.timer.advanceClock();
      this.dma.advanceClock();
      this.hdma.advanceClock();
    }
  }
}
