import { RAM } from "../memory/ram";
import { Memory } from "../memory/types";

// Gameboy APU runs at the master clock of CPU (4.194304MHz) - Meaning that
// it can output sound at that pace. Obviously, this is improbable to directly
// tap into modern computer's audio, and it's impossible to hear that.
// Instead, we'll down-sample 4.194304MHz into 32,768Hz. This means that APU
// will generate signal for each 128 clocks.
const SAMPLE_RATE = 32768;
const CLOCKS_PER_SAMPLE = 4194304 / SAMPLE_RATE;
const SAMPLE_SIZE = 600;

export class APU implements Memory {
  audioCtx: AudioContext;
  buffer: AudioBuffer;
  clocks: number;
  bufferPos: number;
  aram: RAM;

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
    this.buffer = audioCtx.createBuffer(2, SAMPLE_SIZE, SAMPLE_RATE);
    this.clocks = 0;
    this.bufferPos = 0;
    this.aram = new RAM(0x30);
  }

  reset(): void {
    this.buffer = this.audioCtx.createBuffer(2, SAMPLE_SIZE, SAMPLE_RATE);
    this.clocks = 0;
    this.bufferPos = 0;
    this.aram = new RAM(0x30);
  }

  read(pos: number): number {
    return this.aram.read(pos);
  }

  write(pos: number, value: number): void {
    return this.aram.write(pos, value);
  }

  step(channel: number): number {
    // NOTE: This is in the range of -1 ~ 1. Be aware of the dynamic range when
    // composing!
    return 0;
  }

  // NOTE: The clock may not directly correspond to the CPU.
  advanceClock(clocks: number): void {
    this.clocks += clocks;
    const futurePos = CLOCKS_PER_SAMPLE;
    while (this.bufferPos < futurePos) {
      for (let channel = 0; channel < 2; channel += 1) {
        const channelData = this.buffer.getChannelData(channel);
        channelData[this.bufferPos] = this.step(channel);
      }
      this.bufferPos += 1;
    }
  }

  finalize(): void {
    while (this.bufferPos < SAMPLE_SIZE) {
      for (let channel = 0; channel < 2; channel += 1) {
        const channelData = this.buffer.getChannelData(channel);
        channelData[this.bufferPos] = this.step(channel);
      }
      this.bufferPos += 1;
    }
    const source = this.audioCtx.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.audioCtx.destination);
    source.start();
    this.buffer = this.audioCtx.createBuffer(2, SAMPLE_SIZE, SAMPLE_RATE);
  }
}
