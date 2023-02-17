import { LCD } from "../lcd/lcd";

const PALETTE = [
  0xffffffff,
  0xaaaaaaff,
  0x555555ff,
  0x000000ff,
];

export function dumpVRAM(lcd: LCD): void {
  let dumpEl = document.getElementById('dump-canvas');
  if (dumpEl == null) {
    dumpEl = document.createElement('canvas');
    dumpEl.id = 'dump-canvas';
    document.body.appendChild(dumpEl);
  }
  const canvas = dumpEl as HTMLCanvasElement;
  canvas.width = 128;
  canvas.height = 192;
  const bitmap = new Uint8ClampedArray(128 * 192 * 4);
  const vram = lcd.vram.bytes;
  for (let i = 0; i < 384; i += 1) {
    let px = (i % 16) * 8;
    let py = Math.floor(i / 16) * 8;
    for (let y = 0; y < 8; y += 1) {
      const tileLine1 = vram[i * 16 + y * 2];
      const tileLine2 = vram[i * 16 + y * 2 + 1];
      for (let x = 0; x < 8; x += 1) {
        const dx = 7 - x;
        const colorId = ((tileLine1 >> dx) & 1) | (((tileLine2 >> dx) & 1) << 1);
        const color = PALETTE[colorId];
        const ax = px + x;
        const ay = py + y;
        bitmap[(ay * 128 + ax) * 4] = (color >>> 24) & 0xff;
        bitmap[(ay * 128 + ax) * 4 + 1] = (color >>> 16) & 0xff;
        bitmap[(ay * 128 + ax) * 4 + 2] = (color >>> 8) & 0xff;
        bitmap[(ay * 128 + ax) * 4 + 3] = color & 0xff;
      }
    }
  }
  const ctx = canvas.getContext('2d');
  const imgData = new ImageData(bitmap, 128, 192);
  ctx?.putImageData(imgData, 0, 0);

  let dumpEl2 = document.getElementById('dump-text');
  if (dumpEl2 == null) {
    dumpEl2 = document.createElement('div');
    dumpEl2.id = 'dump-text';
    dumpEl2.style.fontFamily = 'monospace';
    document.body.appendChild(dumpEl2);
  }
  // Read OAM
  const oam = lcd.oam.bytes;
  const oams = [];
  for (let i = 0; i < 160; i += 4) {
    const spriteY = oam[i] - 16;
    const spriteX = oam[i + 1] - 8;
    const tileId = oam[i + 2];
    const attributes = oam[i + 3];
    oams.push(`${spriteX.toString(16).padStart(2, '0')} ${spriteY.toString(16).padStart(2, '0')} ${tileId.toString(16).padStart(2, '0')} ${attributes.toString(16).padStart(2, '0')}`);
  }
  dumpEl2.innerText = oams.join('\n');
}
