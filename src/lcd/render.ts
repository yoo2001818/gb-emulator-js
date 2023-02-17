import { LCD, LCDC, LCD_HEIGHT, LCD_WIDTH } from "./lcd";

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

function renderLineBG(lcd: LCD, line: number): void {
  if ((lcd.lcdc & LCDC.BG_WINDOW_DISPLAY) === 0) return;

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
    const tileAddr = getBGTileDataAddress(lcd, tileId);
    const tileLine1 = vram[tileAddr + py * 2];
    const tileLine2 = vram[tileAddr + py * 2 + 1];

    // Paint the pixel..
    while (px >= 0) {
      const colorId = ((tileLine1 >> px) & 1) | (((tileLine2 >> px) & 1) << 1);
      const color = (lcd.bgp >> (colorId << 1)) & 0x03;
      lcd.framebuffer[fbAddr + currentX] = color;
      px -= 1;
      currentX += 1;
    }
  } while (currentX < LCD_WIDTH);
}

function renderLineWindow(lcd: LCD, line: number): void {
  if ((lcd.lcdc & LCDC.BG_WINDOW_DISPLAY) === 0) return;
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
    const tileAddr = getBGTileDataAddress(lcd, tileId);
    const tileLine1 = vram[tileAddr + py * 2];
    const tileLine2 = vram[tileAddr + py * 2 + 1];

    // Paint the pixel..
    while (px >= 0) {
      const colorId = ((tileLine1 >> px) & 1) | (((tileLine2 >> px) & 1) << 1);
      const color = (lcd.bgp >> (colorId << 1)) & 0x03;
      lcd.framebuffer[fbAddr + currentX] = color;
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
    const tileId = oam[i + 2];
    const attributes = oam[i + 3];

    const obp = (attributes & ATTRIBUTE.PALETTE) ? lcd.obp1 : lcd.obp0;
    const flipX = (attributes & ATTRIBUTE.X_FLIP) !== 0;
    const flipY = (attributes & ATTRIBUTE.Y_FLIP) !== 0;
    const bgWindowOverObj = (attributes & ATTRIBUTE.BG_WINDOW_OVER_OBJ) !== 0;

    if (flipY) py = spriteHeight - py;

    const tileLine1 = vram[tileId * 16 + py * 2];
    const tileLine2 = vram[tileId * 16 + py * 2 + 1];
    for (let x = 0; x < 8; x += 1) {
      const px = flipX ? x : (7 - x);
      const currentX = spriteX + x;
      if (currentX < 0 || currentX >= LCD_WIDTH) continue;
      const colorId = ((tileLine1 >> px) & 1) | (((tileLine2 >> px) & 1) << 1);
      if (colorId === 0) continue;
      const color = (obp >> (colorId << 1)) & 0x03;
      if (bgWindowOverObj) {
        const currentColor = lcd.framebuffer[fbAddr + currentX];
        if (currentColor !== 0) continue;
      }
      lcd.framebuffer[fbAddr + currentX] = color;
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
