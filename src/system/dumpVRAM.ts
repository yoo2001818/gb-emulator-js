import { LCD, LCDC } from "../lcd/lcd";

const PALETTE = [
  0xffffffff,
  0xaaaaaaff,
  0x555555ff,
  0x000000ff,
];

// TODO: Refactor this; this is copied from LCD render code
function getBGTileDataAddress(lcd: LCD, id: number): number {
  const bgTileSigned = (lcd.lcdc & LCDC.BG_WINDOW_TILE_DATA_SELECT) === 0;
  if (bgTileSigned) {
    // Video RAM starts with 0x8000. Therefore 0x800 here maps to 0x8800.
    if (id >= 128) return 0x800 + (id - 128) * 16;
    return 0x1000 + id * 16;
  }
  return id * 16;
}

function getBGTileId(lcd: LCD, x: number, y: number): number {
  // Again, this is directly read from VRAM.
  const bgMapBase = (lcd.lcdc & LCDC.BG_TILE_MAP_DISPLAY_SELECT) ? 0x1c00 : 0x1800;
  return lcd.vram.read(bgMapBase + (32 * y) + x);
}

function getWindowTileId(lcd: LCD, x: number, y: number): number {
  // Again, this is directly read from VRAM.
  const bgMapBase = (lcd.lcdc & LCDC.WINDOW_TILE_MAP_DISPLAY_SELECT) ? 0x1c00 : 0x1800;
  return lcd.vram.read(bgMapBase + (32 * y) + x);
}

function drawTilemap(lcd: LCD, bitmap: Uint8ClampedArray): void {
  // BG
  for (let y = 0; y < 256; y += 1) {
    const vram = lcd.vram.bytes;
    const drawY = y;
    const tileY = (drawY / 8) & 0x1f;
    const py = drawY % 8;

    let currentX = 0;
    do {
      const drawX = currentX;
      const tileX = (drawX / 8) & 0x1f;
      let px = 7 - (drawX % 8);

      // Read tile data of the current position
      const tileId = getBGTileId(lcd, tileX, tileY);
      const tileAddr = getBGTileDataAddress(lcd, tileId);
      const tileLine1 = vram[tileAddr + py * 2];
      const tileLine2 = vram[tileAddr + py * 2 + 1];

      // Paint the pixel..
      while (px >= 0) {
        const colorId = ((tileLine1 >> px) & 1) | (((tileLine2 >> px) & 1) << 1);
        const colorId2 = (lcd.bgp >> (colorId << 1)) & 0x03;
        const color = PALETTE[colorId2];
        const ax = currentX;
        const ay = y;
        bitmap[(ay * 512 + ax) * 4] = (color >>> 24) & 0xff;
        bitmap[(ay * 512 + ax) * 4 + 1] = (color >>> 16) & 0xff;
        bitmap[(ay * 512 + ax) * 4 + 2] = (color >>> 8) & 0xff;
        bitmap[(ay * 512 + ax) * 4 + 3] = color & 0xff;
        px -= 1;
        currentX += 1;
      }
    } while (currentX < 256);
  }

  // Window
  for (let y = 0; y < 256; y += 1) {
    const vram = lcd.vram.bytes;
    const drawY = y;
    const tileY = (drawY / 8) & 0x1f;
    const py = drawY % 8;

    let currentX = 0;
    do {
      const drawX = currentX;
      const tileX = (drawX / 8) & 0x1f;
      let px = 7 - (drawX % 8);

      // Read tile data of the current position
      const tileId = getWindowTileId(lcd, tileX, tileY);
      const tileAddr = getBGTileDataAddress(lcd, tileId);
      const tileLine1 = vram[tileAddr + py * 2];
      const tileLine2 = vram[tileAddr + py * 2 + 1];

      // Paint the pixel..
      while (px >= 0) {
        const colorId = ((tileLine1 >> px) & 1) | (((tileLine2 >> px) & 1) << 1);
        const colorId2 = (lcd.bgp >> (colorId << 1)) & 0x03;
        const color = PALETTE[colorId2];
        const ax = currentX + 256;
        const ay = y;
        bitmap[(ay * 512 + ax) * 4] = (color >>> 24) & 0xff;
        bitmap[(ay * 512 + ax) * 4 + 1] = (color >>> 16) & 0xff;
        bitmap[(ay * 512 + ax) * 4 + 2] = (color >>> 8) & 0xff;
        bitmap[(ay * 512 + ax) * 4 + 3] = color & 0xff;
        px -= 1;
        currentX += 1;
      }
    } while (currentX < 256);
  }


}

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

  let dumpEl3 = document.getElementById('dump-canvas-2');
  if (dumpEl3 == null) {
    dumpEl3 = document.createElement('canvas');
    dumpEl3.id = 'dump-canvas-2';
    document.body.appendChild(dumpEl3);
  }
  const canvas2 = dumpEl3 as HTMLCanvasElement;
  canvas2.width = 512;
  canvas2.height = 256;
  const bitmap2 = new Uint8ClampedArray(512 * 256 * 4);
  drawTilemap(lcd, bitmap2);
  const ctx2 = canvas2.getContext('2d');
  const imgData2 = new ImageData(bitmap2, 512, 256);
  ctx2?.putImageData(imgData2, 0, 0);

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
