import { LCD, LCDC, LCD_HEIGHT, LCD_WIDTH } from "./lcd";

function getBGTileDataAddress(lcd: LCD, id: number, bank: number = 0): number {
  const bgTileSigned = (lcd.lcdc & LCDC.BG_WINDOW_TILE_DATA_SELECT) === 0;
  const base = bank * 0x2000;
  if (bgTileSigned) {
    // Video RAM starts with 0x8000. Therefore 0x800 here maps to 0x8800.
    if (id >= 128) return base + 0x800 + (id - 128) * 16;
    return base + 0x1000 + id * 16;
  }
  return base + id * 16;
}

function getBGTileId(lcd: LCD, x: number, y: number): number {
  // Again, this is directly read from VRAM.
  const bgMapBase = (lcd.lcdc & LCDC.BG_TILE_MAP_DISPLAY_SELECT) ? 0x1c00 : 0x1800;
  return lcd.vram.read(bgMapBase + (32 * y) + x);
}

function getBGTileAttributes(lcd: LCD, x: number, y: number): number {
  const bgMapBase = (lcd.lcdc & LCDC.BG_TILE_MAP_DISPLAY_SELECT) ? 0x3c00 : 0x3800;
  return lcd.vram.read(bgMapBase + (32 * y) + x);
}

function getWindowTileId(lcd: LCD, x: number, y: number): number {
  const bgMapBase = (lcd.lcdc & LCDC.WINDOW_TILE_MAP_DISPLAY_SELECT) ? 0x1c00 : 0x1800;
  return lcd.vram.read(bgMapBase + (32 * y) + x);
}

function getWindowTileAttributes(lcd: LCD, x: number, y: number): number {
  const bgMapBase = (lcd.lcdc & LCDC.WINDOW_TILE_MAP_DISPLAY_SELECT) ? 0x3c00 : 0x3800;
  return lcd.vram.read(bgMapBase + (32 * y) + x);
}

function getBGPaletteColor(lcd: LCD, paletteId: number, colorId: number): number {
  const addr = paletteId * 8 + colorId * 2;
  return lcd.bgPalette[addr] | (lcd.bgPalette[addr + 1] << 8);
}

function getOBJPaletteColor(lcd: LCD, paletteId: number, colorId: number): number {
  const addr = paletteId * 8 + colorId * 2;
  return lcd.objPalette[addr] | (lcd.objPalette[addr + 1] << 8);
}

function renderLineBG(lcd: LCD, line: number): void {
  const isCGB = lcd.isCGB;
  const lcdcPriority = (lcd.lcdc & LCDC.BG_WINDOW_DISPLAY) === 0;
  // GB: If BG_WINDOW_DISPLAY is 0, don't render BG and window
  if (!isCGB && lcdcPriority) {
    // FIXME: Clear priority data
    return;
  }
  const vram = lcd.vram.bytes;
  const drawY = line + lcd.scy;
  const tileY = (drawY / 8) & 0x1f;
  const py = drawY % 8;
  const fbAddr = line * LCD_WIDTH;

  let currentX = 0;
  do {
    const drawX = currentX + lcd.scx;
    const tileX = (drawX / 8) & 0x1f;
    let px = 7 - (drawX % 8);

    // Read tile data of the current position
    const tileId = getBGTileId(lcd, tileX, tileY);
    const tileAttributes = getBGTileAttributes(lcd, tileX, tileY);
    const tilePalette = tileAttributes & 0x7;
    const tileBank = (tileAttributes >>> 3) & 1;
    const tileHFlip = (tileAttributes & 0x20) !== 0;
    const tileVFlip = (tileAttributes & 0x40) !== 0;
    const tilePriority = (tileAttributes & 0x80) !== 0;

    const vy = tileVFlip ? 7 - py : py;

    const tileAddr = getBGTileDataAddress(lcd, tileId, tileBank);
    const tileLine1 = vram[tileAddr + vy * 2];
    const tileLine2 = vram[tileAddr + vy * 2 + 1];

    // Paint the pixel..
    while (px >= 0) {
      const vx = tileHFlip ? 7 - px : px;
      const colorId = ((tileLine1 >> vx) & 1) | (((tileLine2 >> vx) & 1) << 1);
      if (isCGB) {
        const color = getBGPaletteColor(lcd, tilePalette, colorId);
        lcd.framebuffer[fbAddr + currentX] = color;
        lcd.lineData[currentX] =
          (tilePriority ? 2 : 0) |
          (colorId > 0 ? 1 : 0);
      } else {
        const color = (lcd.bgp >> (colorId << 1)) & 0x03;
        lcd.framebuffer[fbAddr + currentX] = color | 0x8000;
        lcd.lineData[currentX] = colorId > 0 ? 1 : 0;
      }
      px -= 1;
      currentX += 1;
    }
  } while (currentX < LCD_WIDTH);
}

function renderLineWindow(lcd: LCD, line: number): void {
  const isCGB = lcd.isCGB;
  if (!isCGB && (lcd.lcdc & LCDC.BG_WINDOW_DISPLAY) === 0) {
    return;
  }
  if ((lcd.lcdc & LCDC.WINDOW_DISPLAY) === 0) return;

  const vram = lcd.vram.bytes;
  const drawY = line - lcd.wy;
  if (drawY < 0) return;
  const tileY = (drawY / 8) & 0x1f;
  const py = drawY % 8;
  const fbAddr = line * LCD_WIDTH;

  let currentX = Math.max(0, lcd.wx - 7);
  do {
    const drawX = currentX - (lcd.wx - 7);
    const tileX = (drawX / 8) & 0x1f;
    let px = 7 - (drawX % 8);

    // Read tile data of the current position
    const tileId = getWindowTileId(lcd, tileX, tileY);
    const tileAttributes = getWindowTileAttributes(lcd, tileX, tileY);
    const tilePalette = tileAttributes & 0x7;
    const tileBank = (tileAttributes >>> 3) & 1;
    const tileHFlip = (tileAttributes & 0x20) !== 0;
    const tileVFlip = (tileAttributes & 0x40) !== 0;
    const tilePriority = (tileAttributes & 0x80) !== 0;

    const vy = tileVFlip ? 7 - py : py;

    const tileAddr = getBGTileDataAddress(lcd, tileId, tileBank);
    const tileLine1 = vram[tileAddr + vy * 2];
    const tileLine2 = vram[tileAddr + vy * 2 + 1];

    // Paint the pixel..
    while (px >= 0) {
      const vx = tileHFlip ? 7 - px : px;
      const colorId = ((tileLine1 >> vx) & 1) | (((tileLine2 >> vx) & 1) << 1);
      if (isCGB) {
        const color = getBGPaletteColor(lcd, tilePalette, colorId);
        lcd.framebuffer[fbAddr + currentX] = color;
        lcd.lineData[currentX] =
          (tilePriority ? 2 : 0) |
          (colorId > 0 ? 1 : 0);
      } else {
        const color = (lcd.bgp >> (colorId << 1)) & 0x03;
        lcd.framebuffer[fbAddr + currentX] = color | 0x8000;
        lcd.lineData[currentX] = colorId > 0 ? 1 : 0;
      }
      px -= 1;
      currentX += 1;
    }
  } while (currentX < LCD_WIDTH);
}

const ATTRIBUTE = {
  PALETTE: 16,
  X_FLIP: 32,
  Y_FLIP: 64,
  BG_WINDOW_OVER_OBJ: 128,
};

export function renderLineSprite(lcd: LCD, line: number): void {
  if ((lcd.lcdc & LCDC.OBJ_DISPLAY) === 0) return;
  const lcdcPriority = (lcd.lcdc & LCDC.BG_WINDOW_DISPLAY) !== 0;
  const isCGB = lcd.isCGB;
  // Read OAM
  const oam = lcd.oam.bytes;
  const vram = lcd.vram.bytes;
  const spriteHeight = (lcd.lcdc & LCDC.OBJ_SIZE) ? 16 : 8;
  const fbAddr = line * LCD_WIDTH;
  for (let i = 0; i < 160; i += 4) {
    const spriteY = oam[i] - 16;
    let py = line - spriteY;
    if (py < 0 || py >= spriteHeight) continue;
    const spriteX = oam[i + 1] - 8;
    let tileId = oam[i + 2];
    const attributes = oam[i + 3];

    const obp = (attributes & ATTRIBUTE.PALETTE) ? lcd.obp1 : lcd.obp0;
    const flipX = (attributes & ATTRIBUTE.X_FLIP) !== 0;
    const flipY = (attributes & ATTRIBUTE.Y_FLIP) !== 0;
    const objPriority = (attributes & ATTRIBUTE.BG_WINDOW_OVER_OBJ) !== 0;
    const palette = attributes & 0x7;
    const tileBank = (attributes >>> 3) & 1;

    if (flipY) py = spriteHeight - 1 - py;
    if (spriteHeight === 16) {
      tileId = tileId & 0xfe;
    }

    const tileLine1 = vram[tileBank * 0x2000 + tileId * 16 + py * 2];
    const tileLine2 = vram[tileBank * 0x2000 + tileId * 16 + py * 2 + 1];
    for (let x = 0; x < 8; x += 1) {
      const px = flipX ? x : (7 - x);
      const currentX = spriteX + x;
      if (currentX < 0 || currentX >= LCD_WIDTH) continue;
      const colorId = ((tileLine1 >> px) & 1) | (((tileLine2 >> px) & 1) << 1);
      if (colorId === 0) continue;
      const prevData = lcd.lineData[currentX];
      const bgColor = (prevData & 1) !== 0;
      const bgPriority = (prevData & 2) !== 0;
      if (isCGB) {
        if (
          bgColor &&
          lcdcPriority &&
          (objPriority || bgPriority)
        ) {
          continue;
        }
        const color = getOBJPaletteColor(lcd, palette, colorId);
        lcd.framebuffer[fbAddr + currentX] = color;
      } else {
        if (bgColor && objPriority) continue;
        const color = (obp >> (colorId << 1)) & 0x03;
        lcd.framebuffer[fbAddr + currentX] = color | 0x8000;
      }
    }
  }
}

export function renderLine(
  lcd: LCD,
  line: number,
): void {
  if (line >= LCD_HEIGHT) return;

  renderLineBG(lcd, line);
  renderLineWindow(lcd, line);
  renderLineSprite(lcd, line);
}
