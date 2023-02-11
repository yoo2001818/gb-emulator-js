import './index.css';
import { Emulator } from './system/emulator';

async function loadROM() {
  const res = await fetch('/pokemon_red.gb');
  const array_buffer = await res.arrayBuffer();
  const buffer = new Uint8Array(array_buffer);
  return buffer;
}

async function start() {
  const rom = await loadROM();
  const emulator = new Emulator();
  emulator.load(rom);
  emulator.reboot();
  emulator.start();
  
  function update() {
    emulator.update();
    requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

start();
