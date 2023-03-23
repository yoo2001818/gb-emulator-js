import { CPU } from '../cpu/cpu';
import { IOBus } from '../io/ioBus';
import { Interrupter } from './interrupter';
import { MemoryBus } from './memoryBus';
import { SystemType, SYSTEM_BOOT_REGISTERS } from './systemType';

export class BaseSystem {
  cpu: CPU;
  interrupter: Interrupter;
  memoryBus: MemoryBus;
  ioBus: IOBus;
  type: SystemType;

  constructor() {
    this.memoryBus = new MemoryBus();
    this.cpu = new CPU(this.memoryBus);
    this.interrupter = new Interrupter(this.cpu);
    this.ioBus = new IOBus();
    this.type = SystemType.DMG;

    this.reset();
  }

  serialize(): any {
    return {
      cpu: this.cpu.serialize(),
      interrupter: this.interrupter.serialize(),
    };
  }

  deserialize(data: any): void {
    this.cpu.deserialize(data.cpu);
    this.interrupter.deserialize(data.interrupter);
  }

  reset(type?: SystemType): void {
    if (type != null) {
      this.type = type;
    }
    this.cpu.reset(SYSTEM_BOOT_REGISTERS[this.type]);
    this.memoryBus.reset();
    this.ioBus.reset();
    this.interrupter.reset();

    this.memoryBus.register(0xff, 0xff, this.ioBus);
    this.interrupter.register(this);
  }
}
