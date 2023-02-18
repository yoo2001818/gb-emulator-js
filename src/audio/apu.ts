import { RAM } from "../memory/ram";
import { Memory } from "../memory/types";

// Gameboy APU runs at the master clock of CPU (4.194304MHz) - Meaning that
// it can output sound at that pace. Obviously, this is improbable to directly
// tap into modern computer's audio, and it's impossible to hear that.
// Instead, we'll down-sample 4.194304MHz into 32,768Hz. This means that APU
// will generate signal for each 128 clocks.
const SAMPLE_RATE = 44100;
const CLOCKS_PER_SAMPLE = 4194304 / SAMPLE_RATE;
const FRAMERATE = 60;
const SAMPLE_SIZE = Math.ceil(SAMPLE_RATE / FRAMERATE);
const SAMPLE_WRITE_SIZE = Math.ceil(SAMPLE_RATE / FRAMERATE);

const NR50 = 20;

const DUTY_CYCLE_TABLE = [
  0xFE, 0x7E, 0x78, 0x81,
];

export class APU implements Memory {
  audioContext: AudioContext | null;
  audioWorkletNode: AudioWorkletNode | null;
  buffer: Float32Array;
  clocks: number;
  bufferPos: number;
  aram: RAM;
  waveClocks: number[];
  waveClockDrifts: number[];
  waveOutputs: number[];
  sweepClock: number;
  noiseLFSR: number;

  constructor() {
    this.audioContext = null;
    this.audioWorkletNode = null;
    this.buffer = new Float32Array(SAMPLE_SIZE * 2);
    this.clocks = 0;
    this.bufferPos = 0;
    this.aram = new RAM(0x30);
    this.waveClocks = [0, 0, 0, 0];
    this.waveClockDrifts = [0, 0, 0, 0];
    this.waveOutputs = [0, 0, 0, 0];
    this.sweepClock = 0;
    this.noiseLFSR = 0;
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
    this.aram = new RAM(0x30);
    this.waveClocks = [0, 0, 0, 0];
    this.waveClockDrifts = [0, 0, 0, 0];
    this.waveOutputs = [0, 0, 0, 0];
    this.sweepClock = 0;
    this.noiseLFSR = 0;
  }

  read(pos: number): number {
    return this.aram.read(pos);
  }

  write(pos: number, value: number): void {
    let writeValue = value;
    const aram = this.aram.bytes;
    // Reset trigger
    if (pos === 0x04 && (writeValue & 0x80)) {
      this.waveClocks[0] = 0;
      this.waveClockDrifts[0] = 0;
      this.sweepClock = 0;
      writeValue &= 0x47;
      aram[NR50 + 2] |= 0x01;
    }
    if (pos === 0x09 && (writeValue & 0x80)) {
      this.waveClocks[1] = 0;
      this.waveClockDrifts[1] = 0;
      writeValue &= 0x47;
      aram[NR50 + 2] |= 0x02;
    }
    if (pos === 0x0e && (writeValue & 0x80)) {
      this.waveClocks[2] = 0;
      this.waveClockDrifts[2] = 0;
      writeValue &= 0x47;
      aram[NR50 + 2] |= 0x04;
    }
    if (pos === 0x13 && (writeValue & 0x80)) {
      this.waveClocks[3] = 0;
      this.waveClockDrifts[3] = 0;
      this.noiseLFSR = 0;
      writeValue &= 0x40;
      aram[NR50 + 2] |= 0x08;
    }
    return this.aram.write(pos, writeValue);
  }

  advanceStepWave(id: number, clocks: number): void {
    const aram = this.aram.bytes;
    const nr52 = aram[NR50 + 2];
    if (((nr52 >> id) & 0x1) === 0) {
      // Turn off; don't do anything
      this.waveOutputs[id] = 0;
      return;
    }

    const offset = id * 5;
    const nr10 = aram[offset]; // sweep
    const nr11 = aram[offset + 1]; // length timer & duty cycle
    const nr12 = aram[offset + 2]; // volume & envelope
    const nr13 = aram[offset + 3]; // wavelength low
    const nr14 = aram[offset + 4]; // wavelength high & control

    let wavelength = nr13 | ((nr14 & 0x07) << 8);
    this.waveClocks[id] += clocks;
    let waveClocks = this.waveClocks[id];
    let waveClockDrifts = this.waveClockDrifts[id];

    // Sweep is only allowed in 1th channel
    if (id === 0) {
      // Compute sweep
      if (nr10 & 0x7) {
        const sweepPace = (nr10 >> 4) & 0xf;
        const sweepDir = nr10 & 0x8;
        const sweepSlope = nr10 & 0x7;
        const sweepId = Math.floor((waveClocks - this.sweepClock) / (65536 * sweepPace));
        if (sweepId > 0) {
          // Triggered
          this.sweepClock = waveClocks;
          const phase = (waveClocks - waveClockDrifts) / (32 * (2048 - wavelength));
          wavelength += wavelength / (1 << sweepSlope) * (sweepDir ? -1 : 1);
          waveClockDrifts = waveClocks - phase * (32 * (2048 - wavelength));
          this.waveClockDrifts[id] = waveClockDrifts;
          if (wavelength > 0x7ff) {
            // Turn off output
            aram[NR50 + 2] &= ~(1 << id);
          } else {
            aram[offset + 3] = wavelength & 0xff;
            aram[offset + 4] = (wavelength >> 8) & 0x07;
          }
        }
      }
    }

    // Envelope generation
    const waveInitialVolume = ((nr12 >> 4) & 0xf);
    const waveEnvelopeDir = nr12 & 0x8;
    const waveSweepPace = nr12 & 0x3;
    let waveVolume = waveInitialVolume;
    if (waveSweepPace > 0) {
      // Envelope timer increments by 64 Hz (every 65536 clocks)
      let envelope = Math.floor(waveClocks / (65536 * waveSweepPace));
      if (!waveEnvelopeDir) envelope = -envelope;
      waveVolume = Math.min(0xf, Math.max(0, waveInitialVolume + envelope));
    }

    const waveDuty = (nr11 >> 6) & 0x3;
    const waveTimer = nr11 & 0x3f;
    // Wave timer increments by 256 Hz (every 16384 clocks)
    const isWavePlaying =
      (!(nr14 & 0x40) || ((waveTimer + Math.floor(waveClocks / 16384)) < 64));
    if (!isWavePlaying) {
      this.waveOutputs[id] = 0;
      return;
    }

    switch (id) {
      case 0:
      case 1: {
        // The wavelength ticks the subfreq (1/8 of freq) at
        // 1048576 / (2048 - wavelen) Hz.
        // In other words, the clock alternates for each 4 * (2048 - wavelen) clocks
        const waveSteps = Math.floor((waveClocks) / (4 * (2048 - wavelength)));

        const substep = waveSteps % 8;
        const signal = (DUTY_CYCLE_TABLE[waveDuty] >> (7 - substep)) & 1;
        this.waveOutputs[id] = (signal ? -1 : 1) * (waveVolume / 0xf);
        break;
      }
      case 2: {
        let waveVolume = (nr12 >> 5) & 0x3;
        // Don't do anything if DAC is off
        if ((nr10 & 0x80) === 0) {
          this.waveOutputs[id] = 0;
          this.waveClockDrifts[id] = waveClocks;
          return;
        }
        // The wavelength ticks the subfreq (1/32 of freq) at
        // 2097152 / (2048 - wavelen) Hz -> 2 * (2048 - wavelen) clocks
        const waveSteps = Math.floor((waveClocks - waveClockDrifts) / (2 * (2048 - wavelength)));
        const substep = waveSteps % 32;
        const readId = substep >> 1;
        const readNibble = substep & 1;
        const byte = aram[0x20 + readId];
        const signal = ((byte >> (readNibble ? 0 : 4)) & 0xf) / 0xf;
        this.waveOutputs[id] = (signal * 2 - 1) * (waveVolume / 0x3);
        break;
      }
      case 3: {
        // Noise channel; we only use LR43 to generate signal
        const clockShift = nr13 >> 4;
        const lfsrWidth = nr13 & 0x08;
        const clockDivider = nr13 & 0x07;
        // The clock is 262144 / (r * (2^s)) Hz, where r is 0.5 when r = 0
        // Meaning that this is triggered every 16 * r * 2^s clocks.
        const clockN = 16 * (clockDivider ? clockDivider : 0.5) * (1 << clockShift);
        const clockId = Math.floor((waveClocks - waveClockDrifts) / clockN);
        if (clockId > 0) {
          // Triggered
          const setBit = lfsrWidth ? 0x8080 : 0x8000;
          let lfsr = this.noiseLFSR;
          lfsr = lfsr | (((lfsr & 1) !== ((lfsr >> 1) & 1)) ? 0 : setBit);
          lfsr = lfsr >>> 1;
          this.noiseLFSR = lfsr;
          waveClockDrifts = waveClocks;
        }
        const signal = this.noiseLFSR & 1;
        this.waveOutputs[id] = (signal ? 1 : -1) * (waveVolume / 0xf) / 4;
        break;
      }
    }
  }

  advanceStep(clocks: number): void {
    this.advanceStepWave(0, clocks);
    this.advanceStepWave(1, clocks);
    this.advanceStepWave(2, clocks);
    this.advanceStepWave(3, clocks);
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
    // const nr50 = aram[NR50];

    let output = 0;
    if (nr51 & (1 << (channel * 4 + 0))) output += this.waveOutputs[0];
    // if (nr51 & (1 << (channel * 4 + 1))) output += this.waveOutputs[1];
    // if (nr51 & (1 << (channel * 4 + 2))) output += this.waveOutputs[2];
    // if (nr51 & (1 << (channel * 4 + 3))) output += this.waveOutputs[3];

    return output / 4;
  }

  // NOTE: The clock may not directly correspond to the CPU.
  advanceClock(clocks: number): void {
    this.clocks += clocks;
    const futurePos = Math.floor(this.clocks / CLOCKS_PER_SAMPLE);
    while (this.bufferPos < futurePos) {
      this.advanceStep(CLOCKS_PER_SAMPLE);
      for (let channel = 0; channel < 2; channel += 1) {
        const offset = SAMPLE_SIZE * channel;
        this.buffer[offset + this.bufferPos] = this.step(channel);
      }
      this.bufferPos += 1;
    }
  }

  finalize(): void {
    while (this.bufferPos < SAMPLE_WRITE_SIZE) {
      this.advanceStep(CLOCKS_PER_SAMPLE);
      for (let channel = 0; channel < 2; channel += 1) {
        const offset = SAMPLE_SIZE * channel;
        this.buffer[offset + this.bufferPos] = this.step(channel);
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
    for (let i = 0; i < 0x30; i += 1) {
      output.push(this.aram.bytes[i].toString(16).padStart(2, '0') + ' ');
      if (i % 0x10 === 0xf) {
        output.push('\n');
      }
    }
    return output.join('');
  }
}
