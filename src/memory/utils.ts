export function serializeBytes(bytes: Uint8Array): string {
  const hexData = [];
  for (let i = 0; i < bytes.length; i += 1) {
    const byte = bytes[i];
    if (byte > 0xf) {
      hexData.push(byte.toString(16));
    } else {
      hexData.push('0' + byte.toString(16));
    }
  }
  return hexData.join('');
}

export function deserializeBytes(data: string, bytes: Uint8Array): void {
  for (let i = 0; i < data.length; i += 1) {
    const pos = i * 2;
    const byte = parseInt(data.slice(pos, pos + 2), 16);
    bytes[i] = byte;
  }
}

