import { BaseSystem } from './baseSystem';
import { SystemType } from './systemType';

export class SpeedController {
  system: BaseSystem | null;
  isDoubleSpeed: boolean;
  shouldChangeSpeed: boolean;

  constructor() {
    this.system = null;
    this.isDoubleSpeed = false;
    this.shouldChangeSpeed = false;
  }

  serialize(): any {
    return {
      isDoubleSpeed: this.isDoubleSpeed,
      shouldChangeSpeed: this.shouldChangeSpeed,
    };
  }

  deserialize(data: any): void {
    this.isDoubleSpeed = data.isDoubleSpeed;
    this.shouldChangeSpeed = data.shouldChangeSpeed;
  }

  register(system: BaseSystem): void {
    this.system = system;
    if (system.type !== SystemType.CGB) return;
    const { ioBus } = system;
    ioBus.register(0x4d, 'KEY1', {
      read: () => {
        let result = 0;
        if (this.isDoubleSpeed) result |= 0x80;
        if (this.shouldChangeSpeed) result |= 0x01;
        return result;
      },
      write: (_, value) => {
        this.shouldChangeSpeed = (value & 0x1) !== 0;
      },
    });
  }

  reset(): void {
    this.isDoubleSpeed = false;
    this.shouldChangeSpeed = false;
  }

  advanceClock(): void {
    if (this.system == null) return;
    if (this.shouldChangeSpeed && !this.system.cpu.isRunning) {
      // Switch the current speed of the system
      this.isDoubleSpeed = !this.isDoubleSpeed;
      this.shouldChangeSpeed = false;
      this.system.cpu.tick(2050);
      this.system.cpu.isRunning = true;
    }
  }
}
