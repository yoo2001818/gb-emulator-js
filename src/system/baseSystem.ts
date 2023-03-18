import { CPU } from '../cpu/cpu';
import { IOBus } from '../io/ioBus';
import { Interrupter } from './interrupter';
import { MemoryBus } from './memoryBus';

export class BaseSystem {
  cpu: CPU;
  interrupter: Interrupter;
  memoryBus: MemoryBus;
  ioBus: IOBus;

  constructor() {
    this.memoryBus = new MemoryBus();
    this.cpu = new CPU(this.memoryBus);
    this.interrupter = new Interrupter(this.cpu);
    this.ioBus = new IOBus();

    this.reset();
  }

  reset(): void {
    this.cpu.reset(true);
    this.memoryBus.reset();
    this.ioBus.reset();
    this.interrupter.reset();

    this.memoryBus.register(0xff, 0xff, this.ioBus);
    this.interrupter.register(this);
  }
}
