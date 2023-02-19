const BUFFER_SIZE = 2048;
const RESUME_SIZE = 256;
const WAIT_SIZE = 128;

class MyAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.setup();
    this.buffers = [
      new Float32Array(BUFFER_SIZE),
      new Float32Array(BUFFER_SIZE),
    ];
    this.bufHead = 0;
    this.bufTail = 0;
    this.bufWriteTail = 0;
    this.remaining = 0;
    this.overwriteSize = 0;
    this.waiting = false;
  }

  setup() {
    // Setup ports, etc
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(e) {
    const data = e.data;
    if (data.buffer) {
      const src = data.buffer;
      const size = data.size;
      const writeSize = data.writeSize;
      if ((this.remaining + data.size) > BUFFER_SIZE) {
        // Buffer overrun!
        return;
      }
      // Append buffer
      for (let chanId = 0; chanId < 2; chanId += 1) {
        const srcOffset = chanId * size;
        const dest = this.buffers[chanId];
        for (let i = 0; i < size; i += 1) {
          dest[(this.bufWriteTail + i) % BUFFER_SIZE] = src[srcOffset + i];
        }
      }
      this.bufTail = (this.bufWriteTail + size) % BUFFER_SIZE;
      this.bufWriteTail = (this.bufWriteTail + writeSize) % BUFFER_SIZE;
      this.remaining += size - this.overwriteSize;
      this.overwriteSize = writeSize - size;
    }
  }

  process(inputList, outputList, parameters) {
    const output = outputList[0];
    if (this.remaining < WAIT_SIZE) {
      this.waiting = true;
    } else if (this.remaining > RESUME_SIZE) {
      this.waiting = false;
    }
    let consumed = 0;
    for (let chanId = 0; chanId < output.length; chanId += 1) {
      const dest = output[chanId];
      const src = this.buffers[chanId];
      consumed = 0;
      for (let i = 0; i < dest.length; i += 1) {
        if (!this.waiting) {
          dest[i] = src[(i + this.bufHead) % BUFFER_SIZE];
          consumed += 1;
        } else {
          dest[i] = 0;
        }
      }
    }
    this.remaining = this.remaining - consumed;
    this.bufHead = (this.bufHead + consumed) % BUFFER_SIZE;
    return true;
  }
};

registerProcessor('gb-passthrough', MyAudioProcessor);
