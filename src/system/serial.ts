import { BaseSystem } from './baseSystem';

const SERIALIZE_FIELDS: (keyof SerialController)[] = [
  'data',
  'inProgress',
  'isFast',
  'isExternal',
];

export class SerialController {
  data: number = 0;
  inProgress: boolean = false;
  isFast: boolean = false;
  isExternal: boolean = false;
  system: BaseSystem | null = null;

  serialize(): any {
    const output: any = {};
    SERIALIZE_FIELDS.forEach((key) => output[key] = this[key]);
    return output;
  }

  deserialize(data: any): void {
    SERIALIZE_FIELDS.forEach((key) => (this[key] as any) = data[key]);
  }

  reset(): void {
    this.data = 0;
    this.inProgress = false;
    this.isFast = false;
    this.isExternal = false;
  }

  register(system: BaseSystem): void {
    this.system = system;
    const { ioBus } = system;
    ioBus.register(0x01, 'SB', {
      read: () => this.data,
      write: (_, value) => {
        this.data = value;
      },
    });
    ioBus.register(0x02, 'SC', {
      read: () => {
        return 0;
      },
      write: (_, value) => {
      },
    });
  }
}
