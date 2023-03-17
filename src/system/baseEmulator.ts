import { APU } from '../audio/apu';
import { Cartridge } from '../cartridge/cartridge';
import { LCD } from '../lcd/lcd';
import { RAM } from '../memory/ram';
import { BaseSystem } from './baseSystem';
import { GamepadController } from './gamepad';
import { SystemTimer } from './timer';

export class BaseEmulator {
  system: BaseSystem;
  ppu: LCD;
  apu: APU;
  timer: SystemTimer;
  gamepad: GamepadController;
  wram: RAM;
  hram: RAM;
  cartridge: Cartridge | null;

  constructor() {
    this.system = new BaseSystem();
    this.ppu = new LCD(this.system.interrupter);
    this.apu = new APU();
    this.timer = new SystemTimer(this.system.interrupter);
    this.gamepad = new GamepadController();
    this.wram = new RAM(0x2000);
    this.hram = new RAM(0x80);
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
    if (this.cartridge != null) {
      this.cartridge.reset();
    }
    
    this.system.memoryBus.register(0xc0, 0xdf, this.wram);
    this.system.memoryBus.register(0xe0, 0xfd, this.wram);
    this.ppu.register(this.system);
    this.apu.register(this.system);
    this.timer.register(this.system);
    this.gamepad.register(this.system);
    this.system.ioBus.registerMemory(0x80, 0x7f, 'HRAM', this.hram);
    if (this.cartridge != null) {
      this.cartridge.register(this.system);
    }

    this.system.cpu.onTick = this.advanceClocks.bind(this);
    console.log(this.system.ioBus);
    console.log(this.system.memoryBus);
  }

  advanceClocks(ticks: number): void {
    for (let i = 0; i < ticks; i += 1) {
      this.ppu.advanceClock();
      this.apu.advanceClock();
      this.timer.advanceClock();
    }
  }
}
