import { RAM } from "../memory/ram";
import { Memory } from "../memory/types";

// Gameboy APU runs at the master clock of CPU (4.194304MHz) - Meaning that
// it can output sound at that pace. Obviously, this is improbable to directly
// tap into modern computer's audio, and it's impossible to hear that.
// Instead, we'll down-sample 4.194304MHz into 32,768Hz. This means that APU
// will generate signal for each 128 clocks.
const SAMPLE_RATE = 32768;
const CLOCKS_PER_SAMPLE = 4194304 / SAMPLE_RATE;
const SAMPLE_SIZE = Math.ceil(32768 / 60);

const NR10 = 0;
const NR20 = 5;
const NR30 = 10;
const NR40 = 15;
const NR50 = 20;

const DUTY_CYCLE_TABLE = [
  0xFE, 0x7E, 0x78, 0x81,
];

export class APU implements Memory {
  audioCtx: AudioContext;
  buffer: AudioBuffer;
  clocks: number;
  bufferPos: number;
  aram: RAM;
  waveClocks: number[];
  waveOutputs: number[];

  constructor(audioCtx: AudioContext) {
    this.audioCtx = audioCtx;
    this.buffer = audioCtx.createBuffer(2, SAMPLE_SIZE, SAMPLE_RATE);
    this.clocks = 0;
    this.bufferPos = 0;
    this.aram = new RAM(0x30);
    this.waveClocks = [0, 0, 0, 0];
    this.waveOutputs = [0, 0, 0, 0];
  }

  reset(): void {
    this.buffer = this.audioCtx.createBuffer(2, SAMPLE_SIZE, SAMPLE_RATE);
    this.clocks = 0;
    this.bufferPos = 0;
    this.aram = new RAM(0x30);
    this.waveClocks = [0, 0, 0, 0];
    this.waveOutputs = [0, 0, 0, 0];
  }

  read(pos: number): number {
    return this.aram.read(pos);
  }

  write(pos: number, value: number): void {
    return this.aram.write(pos, value);
  }

  advanceStepWave(id: number, clocks: number): void {
    const aram = this.aram.bytes;

    const offset = id * 5;
    const nr10 = aram[offset]; // sweep
    const nr11 = aram[offset + 1]; // length timer & duty cycle
    const nr12 = aram[offset + 2]; // volume & envelope
    const nr13 = aram[offset + 3]; // wavelength low
    const nr14 = aram[offset + 4]; // wavelength high & control

    // FIXME: NR10

    // The wavelength ticks the subfreq (1/8 of freq) at
    // 1048576 / (2048 - wavelen) Hz.
    // In other words, the clock alternates for each 4 * (2048 - wavelen) clocks
    const wavelength = nr13 | ((nr14 & 0x07) << 8);
    this.waveClocks[id] += clocks;
    const waveClocks = this.waveClocks[0];
    const waveSteps = waveClocks / (4 * (2048 - wavelength));

    const waveDuty = (nr11 >> 6) & 0x3;
    const waveTimer = nr11 & 0x3f;
    const waveVolume = ((nr12 >> 4) & 0xf) / 0xf;
    const waveEnvelopeDir = nr12 & 0x8;
    const waveSweepPace = nr12 & 0x3;

    const substep = waveSteps % 8;
    const pulse = (DUTY_CYCLE_TABLE[waveDuty] >> (7 - substep)) & 1;
    this.waveOutputs[id] = (pulse ? 1 : -1) * waveVolume;
  }

  advanceStep(clocks: number): void {
    this.advanceStepWave(0, clocks);
    this.advanceStepWave(1, clocks);
  }

  step(channel: number): number {
    // NOTE: This is in the range of -1 ~ 1. Be aware of the dynamic range when
    // composing!

    const aram = this.aram.bytes;
    const nr52 = aram[NR50 + 2];
    // NR52 Bit 7: All sound on/off
    if ((nr52 & 0x80) === 0) return 0;
    // NR51: Sound panning
    const nr51 = aram[NR50 + 1];
    // NR50: Master volume, VIN panning
    const nr50 = aram[NR50];

    return this.waveOutputs[0] + this.waveOutputs[1];
  }

  // NOTE: The clock may not directly correspond to the CPU.
  advanceClock(clocks: number): void {
    this.clocks += clocks;
    const futurePos = Math.floor(this.clocks / CLOCKS_PER_SAMPLE);
    while (this.bufferPos < futurePos) {
      this.advanceStep(CLOCKS_PER_SAMPLE);
      for (let channel = 0; channel < 2; channel += 1) {
        const channelData = this.buffer.getChannelData(channel);
        channelData[this.bufferPos] = this.step(channel);
      }
      this.bufferPos += 1;
    }
  }

  finalize(): void {
    while (this.bufferPos < SAMPLE_SIZE) {
      this.advanceStep(CLOCKS_PER_SAMPLE);
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
    this.bufferPos = 0;
    this.clocks = 0;
  }
}
