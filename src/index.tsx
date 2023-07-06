import './index.css';
import { LCD_HEIGHT, LCD_WIDTH } from './ppu/ppu';
import { dumpVRAM } from './system/dumpVRAM';
import { Emulator } from './system/emulator';
import { BUTTON } from './system/gamepad';
import { downloadFile } from './utils/downloadFile';

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

const FRAME_RATE = 1000 / 60;

async function start() {
  let prevTime = performance.now();
  const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
  canvas.width = LCD_WIDTH;
  canvas.height = LCD_HEIGHT;
  const emulator = new Emulator(canvas);
  const rom = await loadROM();
  await emulator.load(rom);
  emulator.reboot();
  emulator.start();

  let storedState: any;

  function update() {
    const delta = performance.now() - prevTime;
    const runFrames = Math.min(10, Math.floor(delta / FRAME_RATE));
    for (let i = 0; i < runFrames; i += 1) {
      emulator.update();
      prevTime += FRAME_RATE;
    }
    if (runFrames === 10) {
      // The computer can't keep up; just update the clock
      prevTime = performance.now();
    }
    requestAnimationFrame(update);
  }
  requestAnimationFrame(update);

  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'q': {
        emulator.isRunning = !emulator.isRunning;
        emulator.isStepping = false;
        if (emulator.emulator.system.cpu.isTrapped) {
          emulator.isRunning = true;
          emulator.emulator.system.cpu.isTrapResolved = true;
          emulator.emulator.system.cpu.isTrapped = false;
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
      case 'r': {
        dumpVRAM(emulator.emulator.ppu);
        break;
      }
      case 't': {
        emulator.isRunning = true;
        emulator.isStepping = false;
        // Run 1 frame
        emulator.update();
        emulator.isRunning = false;
        break;
      }
      case 's': {
        emulator.emulator.system.cpu.isBreakpointsEnabled =
          !emulator.emulator.system.cpu.isBreakpointsEnabled;
        break;
      }
      case '1': {
        const data = emulator.getSRAM();
        if (data != null) {
          downloadFile(emulator.emulator.cartridge!.info.title + '.sav', data);
        }
        break;
      }
      case '2': {
        const data = emulator.serialize();
        storedState = data;
        break;
      }
      case '3': {
        if (storedState != null) {
          emulator.deserialize(storedState);
        }
        break;
      }
      case '4': {
        if (storedState != null) {
          downloadFile(
            emulator.emulator.cartridge!.info.title + '.state',
            JSON.stringify(storedState)
          );
        }
        break;
      }
    }
    const mappedButton = CONTROLS_MAP[e.key];
    if (mappedButton != null) {
      e.preventDefault();
      emulator.emulator.gamepad.set(mappedButton, true);
    }
  });
  window.addEventListener('keyup', (e) => {
    const mappedButton = CONTROLS_MAP[e.key];
    if (mappedButton != null) {
      e.preventDefault();
      emulator.emulator.gamepad.set(mappedButton, false);
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
      if (file.name.endsWith('.state')) {
        const reader = new FileReader();
        reader.onload = async (e2) => {
          const json = e2.target!.result as string;
          const data = JSON.parse(json);
          storedState = data;
          emulator.deserialize(data);
        };
        reader.readAsText(file);
      } else {
        const reader = new FileReader();
        reader.onload = async (e2) => {
          const array_buffer = e2.target!.result as ArrayBuffer;
          const buffer = new Uint8Array(array_buffer);
          if (file.name.endsWith('.sav')) {
            emulator.loadSRAMFromFile(buffer);
            emulator.reboot();
            emulator.start();
          } else {
            await emulator.load(buffer);
            emulator.reboot();
            emulator.start();
          }
        };
        reader.readAsArrayBuffer(file);
      }
    }
  });

  window.addEventListener('click', async () => {
    emulator.emulator.apu.setup();
  });
}

start();
