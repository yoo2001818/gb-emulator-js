import { PPU, LCD_HEIGHT, LCD_WIDTH } from "../ppu/ppu";

const PALETTE = [
  0xffffffff,
  0xaaaaaaff,
  0x555555ff,
  0x000000ff,
];

function convertColor(value: number): number {
  if (value & 0x8000) {
    // GB palette
    return PALETTE[value & 0x3];
  }
  // CGB palette
  const red = ((value & 0x1f) * 0xff / 0x1f) | 0;
  const green = (((value >> 5) & 0x1f) * 0xff / 0x1f) | 0;
  const blue = (((value >> 10) & 0x1f) * 0xff / 0x1f) | 0;
  return (red << 24) | (green << 16) | (blue << 8) | 0xff;
}

export function drawCanvas(lcd: PPU, canvas: CanvasRenderingContext2D): void {
  const imgData = canvas.createImageData(LCD_WIDTH, LCD_HEIGHT);
  const data = imgData.data;
  for (let y = 0; y < LCD_HEIGHT; y += 1) {
    for (let x = 0; x < LCD_WIDTH; x += 1) {
      const colorValue = lcd.framebuffer[y * LCD_WIDTH + x];
      const color = convertColor(colorValue);
      data[(y * LCD_WIDTH + x) * 4] = (color >>> 24) & 0xff;
      data[(y * LCD_WIDTH + x) * 4 + 1] = (color >>> 16) & 0xff;
      data[(y * LCD_WIDTH + x) * 4 + 2] = (color >>> 8) & 0xff;
      data[(y * LCD_WIDTH + x) * 4 + 3] = color & 0xff;
    }
  }
  canvas.putImageData(imgData, 0, 0);
}
