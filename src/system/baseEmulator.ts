import { APU } from '../audio/apu';
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
  hiram: RAM;

  constructor() {
    this.system = new BaseSystem();
    this.ppu = new LCD(this.system.interrupter);
    this.apu = new APU();
    this.timer = new SystemTimer(this.system.interrupter);
    this.gamepad = new GamepadController();
    this.wram = new RAM(0x2000);
    this.hiram = new RAM(0x80);
  }

  reset(): void {
    this.system.reset();
    this.wram.reset();
    this.hiram.reset();
    this.ppu.reset();
    this.apu.reset();
    this.timer.reset();
    this.gamepad.reset();
    
    this.system.memoryBus.register(0xc0, 0xcf, this.wram);
    this.system.memoryBus.register(0xe0, 0xef, this.wram);
    this.ppu.register(this.system);
    this.apu.register(this.system);
    this.timer.register(this.system);
    this.gamepad.register(this.system);
    // WHY
    for (let i = 0x80; i < 0xff; i += 1) {
      this.system.ioBus.register(i, 'HIRAM', {
        read: () => this.hiram.read(i - 0x80),
        write: (_, value) => this.hiram.write(i - 0x80, value),
      });
    }
  }
}
