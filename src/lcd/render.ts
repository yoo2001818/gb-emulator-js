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
  const bg_data_base = (lcd.lcdc & LCDC.BG_WINDOW_TILE_DATA_SELECT) ? 0x8000 : 0x8800;
  const bg_map_base = (lcd.lcdc & LCDC.BG_TILE_MAP_DISPLAY_SELECT) ? 0x9c00 : 0x9800;
  // Each tile is 8x8, therefore we can select tile Y like this:
  const bg_y = (line / 8) | 0;
  const bg_yd = line % 8;
  for (let x = 0; x < LCD_WIDTH; x += 1) {
    const bg_x = (x / 8) | 0;
    const bg_xd = 8 - (x % 8);
    // Fetch the requested tile
    const tile_id = memory.read(bg_map_base + (32 * bg_y) + bg_x);
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
}
