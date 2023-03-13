import { CPU } from '../cpu/cpu';
import { IOBus } from '../io/ioBus';
import { Interrupter } from './interrupter';
import { MemoryBus2 } from './memoryBus2';

export class BaseSystem {
  cpu: CPU;
  interrupter: Interrupter;
  memoryBus: MemoryBus2;
  ioBus: IOBus;

  constructor() {
    this.memoryBus = new MemoryBus2();
    this.cpu = new CPU(this.memoryBus);
    this.interrupter = new Interrupter(this.cpu);
    this.ioBus = new IOBus();

    this.reset();
  }

  reset(): void {
    this.memoryBus.reset();
    this.ioBus.reset();
    // TODO: Interrupter
    this.memoryBus.register(0xff, 0xff, this.ioBus);
  }
}
