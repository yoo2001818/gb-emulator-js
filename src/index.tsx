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

let storedState: any;

function processFile(emulator: Emulator, file: File) {
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

const ACTIONS = {
  open: (emulator: Emulator) => {
    const inputEl = document.createElement('input');
    inputEl.type = 'file';
    inputEl.accept = '.gb,.gbc,.sav,.state';
    inputEl.click();
    inputEl.addEventListener('change', () => {
      const file = (inputEl.files ?? [])[0];
      if (file != null) {
        processFile(emulator, file);
      }
    });
  },
  play: (emulator: Emulator) => {
    emulator.isRunning = !emulator.isRunning;
    emulator.isStepping = false;
    if (emulator.emulator.system.cpu.isTrapped) {
      emulator.isRunning = true;
      emulator.emulator.system.cpu.isTrapResolved = true;
      emulator.emulator.system.cpu.isTrapped = false;
    }
  },
  reset: (emulator: Emulator) => {
    emulator.reboot();
    emulator.start();
  },
  stepFrame: (emulator: Emulator) => {
    emulator.isRunning = true;
    emulator.isStepping = false;
    // Run 1 frame
    emulator.update();
    emulator.isRunning = false;
  },
  stepClock: (emulator: Emulator) => {
    emulator.isRunning = true;
    emulator.isStepping = true;
  },
  loadState: (emulator: Emulator) => {
    if (storedState != null) {
      emulator.deserialize(storedState);
    }
  },
  saveState: (emulator: Emulator) => {
    const data = emulator.serialize();
    storedState = data;
  },
  downloadState: (emulator: Emulator) => {
    if (storedState != null) {
      downloadFile(
        emulator.emulator.cartridge!.info.title + '.state',
        JSON.stringify(storedState)
      );
    }
  },
  downloadSave: (emulator: Emulator) => {
    const data = emulator.getSRAM();
    if (data != null) {
      downloadFile(emulator.emulator.cartridge!.info.title + '.sav', data);
    }
  },
  toggleDebugStats: (emulator: Emulator) => {
    const debugStatsElem = document.querySelector(
      '#debug-stats-txt'
    ) as HTMLDivElement;
    if (emulator.debugTextElem == null) {
      emulator.debugTextElem = debugStatsElem;
      debugStatsElem.style.display = 'block';
    } else {
      emulator.debugTextElem = null;
      debugStatsElem.style.display = 'none';
    }
  },
  dumpVRAM: (emulator: Emulator) => {
    dumpVRAM(emulator.emulator.ppu);
  },
};

const FRAME_RATE = 1000 / 60;

function start() {
  let prevTime = performance.now();
  const canvas = document.querySelector('#canvas') as HTMLCanvasElement;
  canvas.width = LCD_WIDTH;
  canvas.height = LCD_HEIGHT;
  const emulator = new Emulator(canvas);
  (window as any).emulator = emulator;

  function update() {
    if (document.hidden) {
      requestAnimationFrame(update);
      return;
    }
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
      case ' ': {
        ACTIONS.play(emulator);
        break;
      }
      case 'q': {
        ACTIONS.stepFrame(emulator);
        break;
      }
      case 'w': {
        ACTIONS.stepClock(emulator);
        break;
      }
      case 'e': {
        ACTIONS.dumpVRAM(emulator);
        break;
      }
      case 'o': {
        emulator.emulator.system.cpu.isBreakpointsEnabled =
          !emulator.emulator.system.cpu.isBreakpointsEnabled;
        break;
      }
      case 'p': {
        ACTIONS.toggleDebugStats(emulator);
        break;
      }
      case '1': {
        ACTIONS.saveState(emulator);
        break;
      }
      case '2': {
        ACTIONS.loadState(emulator);
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
      processFile(emulator, files[0]);
    }
  });

  window.addEventListener('click', async () => {
    emulator.emulator.apu.setup();
  });

  (
    [
      ['#open', 'open'],
      ['#download-sav', 'downloadSave'],
      ['#play', 'play'],
      ['#reset', 'reset'],
      ['#step-frame', 'stepFrame'],
      ['#download-state', 'downloadState'],
      ['#toggle-debug-stats', 'toggleDebugStats'],
      ['#dump-vram', 'dumpVRAM'],
    ] as const
  ).forEach(([qsName, actionName]) => {
    document.querySelector(qsName)?.addEventListener('click', () => {
      ACTIONS[actionName](emulator);
    });
  });

  document.querySelector('#open')?.addEventListener('click', () => {
    ACTIONS.open(emulator);
  });

  const romListEl = document.querySelector('#romlist') as HTMLUListElement;
  [
    ['drmario.gb', 'Dr. Mario'],
    ['marioland.gb', 'Super Mario Land'],
    ['mariogolf.gb', 'Mario Golf'],
    ['pokemon_red.gb', 'Pokemon Red'],
    ['pokemon_blue.gb', 'Pokemon Blue'],
    ['pokemon_yellow.gb', 'Pokemon Yellow'],
    ['pokemon_gold.gb', 'Pokemon Gold'],
    ['pokemon_silver.gb', 'Pokemon Silver'],
    ['pokemon_gold_kor.gb', 'Pokemon Gold (Korean)'],
    ['pokemon_crystal.gb', 'Pokemon Crystal'],
    ['tetris.gb', 'Tetris'],
    ['zelda.gb', 'Legend of Zelda'],
    ['kirby.gb', "Kirby's Dream Land"],
  ].forEach(([romPath, romName]) => {
    const romEl = document.createElement('li');
    const buttonEl = document.createElement('a');
    buttonEl.href = '#';
    buttonEl.addEventListener('click', async (e) => {
      e.preventDefault();
      const res = await fetch(`./${romPath}`);
      const array_buffer = await res.arrayBuffer();
      const rom = new Uint8Array(array_buffer);
      await emulator.load(rom);
      emulator.reboot();
      emulator.start();
    });
    buttonEl.appendChild(document.createTextNode(romName));
    romEl.appendChild(buttonEl);
    romListEl.appendChild(romEl);
  });

  (async () => {
    const res = await fetch('./pokemon_red.gb');
    const array_buffer = await res.arrayBuffer();
    const rom = new Uint8Array(array_buffer);
    await emulator.load(rom);
    emulator.reboot();
    emulator.start();
  })();
}

start();
