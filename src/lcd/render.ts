import { Memory } from "../memory/types";
import { LCD, LCDC, LCD_HEIGHT, LCD_WIDTH } from "./lcd";

const LCD_COLOR_PALETTE = [
  0xffffffff,
  0xaaaaaaff,
  0x555555ff,
  0x000000ff,
]

export function renderLCDLine(
  memory: Memory,
  lcd: LCD,
  // The bitmap data we'll send to the canvas
  // Therefore, it's a RGBA data
  output: Uint8ClampedArray,
  line: number,
): void {
  if (line >= LCD_HEIGHT) return;
  // if (!(lcd.lcdc & LCDC.ENABLED)) return;

  // Draw background
  const bg_tile_signed = (lcd.lcdc & LCDC.BG_WINDOW_TILE_DATA_SELECT) === 0;
  const bg_data_base = bg_tile_signed ? 0x9000 : 0x8000;
  const bg_map_base = (lcd.lcdc & LCDC.BG_TILE_MAP_DISPLAY_SELECT) ? 0x9c00 : 0x9800;
  // Each tile is 8x8, therefore we can select tile Y like this:
  const bg_y = (line / 8) | 0;
  const bg_yd = line % 8;
  for (let x = 0; x < LCD_WIDTH; x += 1) {
    const bg_x = (x / 8) | 0;
    const bg_xd = 7 - (x % 8);
    // Fetch the requested tile
    let tile_id = memory.read(bg_map_base + (32 * bg_y) + bg_x);
    if (bg_tile_signed && (tile_id & 0x80)) {
      tile_id = -((~tile_id + 1) & 0xff);
    }
    const tile_data_base = bg_data_base + tile_id * 16 + bg_yd * 2;
    const tile_line1 = memory.read(tile_data_base);
    const tile_line2 = memory.read(tile_data_base + 1);
    const color_id = ((tile_line1 >> bg_xd) & 1) | (((tile_line2 >> bg_xd) & 1) << 1);
    const color = (lcd.bgp >> (color_id << 1)) & 0x03;
    // Set color 
    const rgb_color = LCD_COLOR_PALETTE[color];
    output[(line * LCD_WIDTH + x) * 4] = (rgb_color >> 24) & 0xff;
    output[(line * LCD_WIDTH + x) * 4 + 1] = (rgb_color >> 16) & 0xff;
    output[(line * LCD_WIDTH + x) * 4 + 2] = (rgb_color >> 8) & 0xff;
    output[(line * LCD_WIDTH + x) * 4 + 3] = rgb_color & 0xff;
  }
  
  // Draw window

  // Read OAM
  const sprite_height = (lcd.lcdc & LCDC.OBJ_SIZE) ? 16 : 8;
  const sprite_data_base = 0x8000;
  for (let i = 0; i < 160; i += 4) {
    const sprite_y = memory.read(0xFE00 + i) - 16;
    const sprite_x = memory.read(0xFE00 + i + 1) - 8;
    const tile_id = memory.read(0xFE00 + i + 2);
    const attributes = memory.read(0xFE00 + i + 3);
    if (sprite_y + sprite_height < line || sprite_y > line) continue;
    const final_y = line - sprite_y;
    const sprite_addr = sprite_data_base + tile_id * 16 + final_y * 2;
    const line1 = memory.read(sprite_addr);
    const line2 = memory.read(sprite_addr + 1);
    for (let x = 0; x < 8; x += 1) {
      const bit_x = 7 - x;
      let final_x = sprite_x + x;
      if (final_x < 0 || final_x >= LCD_WIDTH) continue;
      const color_id = ((line1 >> bit_x) & 1) | (((line2 >> bit_x) & 1) << 1);
      const color = color_id;
      // Set color 
      const rgb_color = LCD_COLOR_PALETTE[color];
      output[(line * LCD_WIDTH + final_x) * 4] = (rgb_color >> 24) & 0xff;
      output[(line * LCD_WIDTH + final_x) * 4 + 1] = (rgb_color >> 16) & 0xff;
      output[(line * LCD_WIDTH + final_x) * 4 + 2] = (rgb_color >> 8) & 0xff;
      output[(line * LCD_WIDTH + final_x) * 4 + 3] = rgb_color & 0xff;
    }
  }
}
