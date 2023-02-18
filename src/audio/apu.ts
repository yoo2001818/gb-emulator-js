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

const NR50 = 20;

export class APU implements Memory {
  audioContext: AudioContext | null;
  audioWorkletNode: AudioWorkletNode | null;
  buffer: Float32Array;
  clocks: number;
  bufferPos: number;
  psgs: PSG[];
  waveTable: RAM;
  aram: RAM;

  constructor() {
    this.audioContext = null;
    this.audioWorkletNode = null;
    this.buffer = new Float32Array(SAMPLE_SIZE * 2);
    this.clocks = 0;
    this.bufferPos = 0;
    this.waveTable = new RAM(0x10);
    this.psgs = [
      new SquarePSG(),
      new SquarePSG(),
      new PCMPSG(this.waveTable),
      new NoisePSG(),
    ];
    this.aram = new RAM(0x30);
  }

  async setup(): Promise<void> {
    if (this.audioContext != null) return;
    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    await this.audioContext.audioWorklet.addModule('/audioWorklet.js');
    this.audioWorkletNode = new AudioWorkletNode(this.audioContext!, 'gb-passthrough');
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
  }

  read(pos: number): number {
    const id = Math.floor(pos / 5);
    if (id < 4) {
      return this.psgs[id].read(pos % 5);
    }
    if (pos >= 0x20) {
      return this.waveTable.read(pos - 0x20);
    }
    return this.aram.read(pos);
  }

  write(pos: number, value: number): void {
    const id = Math.floor(pos / 5);
    if (id < 4) {
      return this.psgs[id].write(pos % 5, value);
    }
    if (pos >= 0x20) {
      return this.waveTable.write(pos - 0x20, value);
    }
    return this.aram.write(pos, value);
  }

  step(clocks: number): void {
    for (let i = 0; i < this.psgs.length; i += 1) {
      this.psgs[i].step(clocks);
    }
  }

  getOutput(channel: number): number {
    // NOTE: This is in the range of -1 ~ 1. Be aware of the dynamic range when
    // composing!

    const aram = this.aram.bytes;
    const nr52 = aram[NR50 + 2];
    // NR52 Bit 7: All sound on/off
    if ((nr52 & 0x80) === 0) return 0;
    // NR51: Sound panning
    const nr51 = aram[NR50 + 1];
    // NR50: Master volume, VIN panning
    // const nr50 = aram[NR50];

    let output = 0;
    for (let i = 0; i < 4; i += 1) {
      if (nr51 & (1 << (channel * 4 + i))) output += this.psgs[i].output;
    }
    return output / 4;
  }

  // NOTE: The clock may not directly correspond to the CPU.
  advanceClock(clocks: number): void {
    this.clocks += clocks;
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
    /*
    const waveClocksCopy = this.waveClocks.slice();
    const waveClockDriftsCopy = this.waveClockDrifts.slice();
    // Create overflown buffer
    while (this.bufferPos < SAMPLE_SIZE) {
      this.advanceStep(CLOCKS_PER_SAMPLE);
      for (let channel = 0; channel < 2; channel += 1) {
        const offset = SAMPLE_SIZE * channel;
        this.buffer[offset + this.bufferPos] = this.step(channel);
      }
      this.bufferPos += 1;
    }
    this.waveClocks = waveClocksCopy;
    this.waveClockDrifts = waveClockDriftsCopy;
    */
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
    let output = ['APU: '];
    this.psgs.forEach((psg) => {
      output.push(psg.getDebugState() + '\n');
    });
    for (let i = 0; i < 0x10; i += 1) {
      output.push(this.waveTable.bytes[i].toString(16).padStart(2, '0') + ' ');
      if (i % 0x10 === 0xf) {
        output.push('\n');
      }
    }
    return output.join('');
  }
}
