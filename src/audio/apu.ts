import { RAM } from "../memory/ram";
import { Memory } from "../memory/types";
import { NoisePSG } from "./psg/noise";
import { PCMPSG } from "./psg/pcm";
import { PSG } from "./psg/psg";
import { SquarePSG } from "./psg/square";

// Gameboy APU runs at the master clock of CPU (4.194304MHz) - Meaning that
// it can output sound at that pace. Obviously, this is improbable to directly
// tap into modern computer's audio, and it's impossible to hear that.
// Instead, we'll down-sample 4.194304MHz into 32,768Hz. This means that APU
// will generate signal for each 128 clocks.
const SAMPLE_RATE = 32768;
const CLOCKS_PER_SAMPLE = 4194304 / SAMPLE_RATE;
const FRAMERATE = 60;
const SAMPLE_SIZE = Math.ceil(SAMPLE_RATE / FRAMERATE);
const SAMPLE_WRITE_SIZE = Math.ceil(SAMPLE_RATE / FRAMERATE);

const SERIALIZE_FIELDS: (keyof APU)[] = [
  'clocks',
  'nr50',
  'nr51',
  'nr52',
];

export class APU implements Memory {
  audioContext: AudioContext | null;
  audioWorkletNode: AudioWorkletNode | null;
  buffer: Float32Array;
  clocks: number;
  bufferPos: number;
  psgs: PSG[];
  waveTable: RAM;
  nr50: number;
  nr51: number;
  nr52: number;

  constructor() {
    this.audioContext = null;
    this.audioWorkletNode = null;
    this.buffer = new Float32Array(SAMPLE_SIZE * 2);
    this.clocks = 0;
    this.bufferPos = 0;
    this.waveTable = new RAM(0x10);
    this.psgs = [
      new SquarePSG(),
      new SquarePSG(false),
      new PCMPSG(this.waveTable),
      new NoisePSG(),
    ];
    this.nr50 = 0;
    this.nr51 = 0;
    this.nr52 = 0;
  }

  async setup(): Promise<void> {
    if (this.audioContext != null) return;
    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    await this.audioContext.audioWorklet.addModule('/audioWorklet.js');
    this.audioWorkletNode = new AudioWorkletNode(
      this.audioContext!,
      'gb-passthrough',
      { numberOfOutputs: 1, outputChannelCount: [2] },
    );
    const biquadFilter = new BiquadFilterNode(this.audioContext!, {
      type: 'highpass',
      Q: 10,
      frequency: 100,
    });
    this.audioWorkletNode!.connect(biquadFilter);
    biquadFilter.connect(this.audioContext!.destination);
  }

  reset(): void {
    this.buffer = new Float32Array(SAMPLE_SIZE * 2);
    this.clocks = 0;
    this.bufferPos = 0;
    this.waveTable.reset();
    this.psgs.forEach((psg) => psg.reset());
    this.nr50 = 0;
    this.nr51 = 0;
    this.nr52 = 0;
  }
  
  serialize(): any {
    const output: any = {};
    output.waveTable = this.waveTable.serialize();
    output.psgs = this.psgs.map((psg) => psg.serialize());
    SERIALIZE_FIELDS.forEach((key) => output[key] = this[key]);
    return output;
  }

  deserialize(data: any): void {
    this.clocks = data.clocks;
    this.waveTable.deserialize(data.waveTable);
    this.psgs.forEach((psg, i) => psg.deserialize(data.psgs[i]));
    SERIALIZE_FIELDS.forEach((key) => (this[key] as any) = data[key]);
  }

  read(pos: number): number {
    const id = Math.floor(pos / 5);
    if (id < 4) {
      return this.psgs[id].read(pos % 5);
    }
    if (pos >= 0x20) {
      return this.waveTable.read(pos - 0x20);
    }
    switch (pos) {
      case 0x14:
        return this.nr50;
      case 0x15:
        return this.nr51;
      case 0x16: {
        let output = this.nr52;
        for (let i = 0; i < this.psgs.length; i += 1) {
          if (this.psgs[i].enabled) output |= (1 << i);
        }
        return output;
      }
      default:
        return 0xff;
    }
  }

  write(pos: number, value: number): void {
    const id = Math.floor(pos / 5);
    if (id < 4) {
      return this.psgs[id].write(pos % 5, value);
    }
    if (pos >= 0x20) {
      return this.waveTable.write(pos - 0x20, value);
    }
    switch (pos) {
      case 0x14:
        this.nr50 = value;
        break;
      case 0x15:
        this.nr51 = value;
        break;
      case 0x16:
        this.nr52 = value & 0x80;
        break;
    }
  }

  step(clocks: number): void {
    // NR52 Bit 7: All sound on/off
    if ((this.nr52 & 0x80) === 0) return;
    for (let i = 0; i < this.psgs.length; i += 1) {
      this.psgs[i].step(clocks);
    }
  }

  getOutput(channel: number): number {
    // NR52 Bit 7: All sound on/off
    if ((this.nr52 & 0x80) === 0) return 0;
    // NR51: Sound panning
    const nr51 = this.nr51;
    // NR50: Master volume, VIN panning
    const nr50 = this.nr50;

    let output = 0;
    for (let i = 0; i < 4; i += 1) {
      if (nr51 & (1 << (channel * 4 + i))) output += this.psgs[i].output;
    }

    if (channel === 0) {
      output *= ((nr50 >>> 4) & 0x7) / 0x7;
    } else {
      output *= (nr50 & 0x7) / 0x7;
    }

    return output / 4;
  }

  // NOTE: The clock may not directly correspond to the CPU.
  advanceClock(): void {
    this.clocks += 4;
    const futurePos = Math.floor(this.clocks / CLOCKS_PER_SAMPLE);
    while (this.bufferPos < futurePos) {
      this.step(Math.floor(CLOCKS_PER_SAMPLE));
      for (let channel = 0; channel < 2; channel += 1) {
        const offset = SAMPLE_SIZE * channel;
        this.buffer[offset + this.bufferPos] = this.getOutput(channel);
      }
      this.bufferPos += 1;
    }
  }

  finalize(): void {
    while (this.bufferPos < SAMPLE_WRITE_SIZE) {
      this.step(Math.floor(CLOCKS_PER_SAMPLE));
      for (let channel = 0; channel < 2; channel += 1) {
        const offset = SAMPLE_SIZE * channel;
        this.buffer[offset + this.bufferPos] = this.getOutput(channel);
      }
      this.bufferPos += 1;
    }
    if (this.audioWorkletNode != null) {
      this.audioWorkletNode.port.postMessage({
        buffer: this.buffer,
        size: SAMPLE_SIZE,
        writeSize: SAMPLE_WRITE_SIZE,
      });
    }
    this.buffer = new Float32Array(SAMPLE_SIZE * 2);
    this.bufferPos = 0;
    this.clocks = 0;
  }

  getDebugState(): string {
    let output = [];
    this.psgs.forEach((psg, i) => {
      output.push(`NR${i + 1}: ` + psg.getDebugState() + '\n');
    });
    output.push(`NR5: V: ${this.nr50.toString(16).padStart(2, '0')} P: ${this.nr51.toString(16).padStart(2, '0')} E: ${(this.nr52 & 0x80) !== 0}\n`);
    output.push('Wave: ');
    for (let i = 0; i < 0x10; i += 1) {
      output.push(this.waveTable.bytes[i].toString(16).padStart(2, '0'));
      if (i % 0x10 === 0xf) {
        output.push('\n');
      }
    }
    return output.join('');
  }
}
