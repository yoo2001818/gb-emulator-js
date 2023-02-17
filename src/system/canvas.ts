import { LCD, LCD_HEIGHT, LCD_WIDTH } from "../lcd/lcd";

const PALETTE = [
  0xffffffff,
  0xaaaaaaff,
  0x555555ff,
  0x000000ff,
];

export function drawCanvas(lcd: LCD, canvas: CanvasRenderingContext2D): void {
  const imgData = canvas.createImageData(LCD_WIDTH, LCD_HEIGHT);
  const data = imgData.data;
  for (let y = 0; y < LCD_HEIGHT; y += 1) {
    for (let x = 0; x < LCD_WIDTH; x += 1) {
      const color = PALETTE[lcd.framebuffer[y * LCD_WIDTH + x]];
      data[(y * LCD_WIDTH + x) * 4] = (color >>> 24) & 0xff;
      data[(y * LCD_WIDTH + x) * 4 + 1] = (color >>> 16) & 0xff;
      data[(y * LCD_WIDTH + x) * 4 + 2] = (color >>> 8) & 0xff;
      data[(y * LCD_WIDTH + x) * 4 + 3] = color & 0xff;
    }
  }
  canvas.putImageData(imgData, 0, 0);
}
