import './index.css';
import { LCD_HEIGHT, LCD_WIDTH } from './lcd/lcd';
import { Emulator } from './system/emulator';
import { BUTTON } from './system/gamepad';

const CONTROLS_MAP: Record<string, number | undefined> = {
  z: BUTTON.B,
  x: BUTTON.A,
  Enter: BUTTON.START,
  Backspace: BUTTON.SELECT,
  ArrowUp: BUTTON.UP,
  ArrowLeft: BUTTON.LEFT,
  ArrowRight: BUTTON.RIGHT,
  ArrowDown: BUTTON.DOWN,
};

async function loadROM() {
  const res = await fetch('/pokemon_red.gb');
  const array_buffer = await res.arrayBuffer();
  const buffer = new Uint8Array(array_buffer);
  return buffer;
}

async function start() {
  let prevTime = Date.now();
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  canvas.width = LCD_WIDTH;
  canvas.height = LCD_HEIGHT;
  canvas.style.width = `${LCD_WIDTH * 2}px`;
  canvas.style.height = `${LCD_HEIGHT * 2}px`;
  const emulator = new Emulator(canvas);
  const rom = await loadROM();
  emulator.load(rom);
  emulator.reboot();
  emulator.start();
  
  function update() {
    const delta = Date.now() - prevTime;
    if (delta > 1000 / 60) {
      prevTime = Date.now();
      emulator.update();
    }
    requestAnimationFrame(update);
  }
  requestAnimationFrame(update);

  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'q': {
        emulator.isRunning = !emulator.isRunning;
        emulator.isStepping = false;
        if (emulator.cpu.isTrapped) {
          emulator.isRunning = true;
          emulator.cpu.isTrapResolved = true;
          emulator.cpu.isTrapped = false;
        }
        break;
      }
      case 'w': {
        for (let i = 0; i < 1000; i += 1) {
          emulator.isRunning = true;
          emulator.isStepping = true;
          emulator.update();
        }
        break;
      }
      case 'e': {
        emulator.isRunning = true;
        emulator.isStepping = true;
        break;
      }
    }
    const mappedButton = CONTROLS_MAP[e.key];
    if (mappedButton != null) {
      e.preventDefault();
      emulator.gamepad.set(mappedButton, true);
    }
  });
  window.addEventListener('keyup', (e) => {
    const mappedButton = CONTROLS_MAP[e.key];
    if (mappedButton != null) {
      e.preventDefault();
      emulator.gamepad.set(mappedButton, false);
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('drop', (e) => {
    e.stopPropagation();
    e.preventDefault();
    const files = e.dataTransfer?.files ?? [];
    if (files[0] != null) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e2) => {
        const array_buffer = e2.target!.result as ArrayBuffer;
        const buffer = new Uint8Array(array_buffer);
        emulator.load(buffer);
        emulator.reboot();
        emulator.start();
      };
      reader.readAsArrayBuffer(file);
    }
  });
}

start();
