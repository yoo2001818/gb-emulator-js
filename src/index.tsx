import './index.css';
import { LCD_HEIGHT, LCD_WIDTH } from './lcd/lcd';
import { Emulator } from './system/emulator';

async function loadROM() {
  const res = await fetch('/drmario.gb');
  const array_buffer = await res.arrayBuffer();
  const buffer = new Uint8Array(array_buffer);
  return buffer;
}

async function start() {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  canvas.width = LCD_WIDTH;
  canvas.height = LCD_HEIGHT;
  canvas.style.width = `${LCD_WIDTH * 2}px`;
  canvas.style.height = `${LCD_HEIGHT * 2}px`;
  const rom = await loadROM();
  const emulator = new Emulator(canvas);
  emulator.load(rom);
  emulator.reboot();
  emulator.start();
  
  function update() {
    emulator.update();
    requestAnimationFrame(update);
  }
  requestAnimationFrame(update);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'p') {
      emulator.isRunning = !emulator.isRunning;
      emulator.isStepping = false;
    }
    if (e.key === ' ') {
      emulator.isRunning = true;
      emulator.isStepping = true;
    }
  });
}

start();
