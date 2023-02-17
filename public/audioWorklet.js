const BUFFER_SIZE = 4000;

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
    }
  }

  process(inputList, outputList, parameters) {
    const output = outputList[0];
    let headAddSize = 0;
    for (let chanId = 0; chanId < output.length; chanId += 1) {
      const dest = output[chanId];
      const src = this.buffers[chanId];
      for (let i = 0; i < dest.length; i += 1) {
        dest[i] = src[(i + this.bufHead) % BUFFER_SIZE];
      }
      headAddSize = dest.length;
    }
    this.bufHead = (this.bufHead + headAddSize) % BUFFER_SIZE;
    return true;
  }
};

registerProcessor('gb-passthrough', MyAudioProcessor);
