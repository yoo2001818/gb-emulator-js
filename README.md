# gb-emulator-js

A Gameboy emulator written in JavaScript. It supports DMG (Original Gameboy)
and CGB (Color Gameboy).

The emulator supports most of components and works well enough, though there
are some timing issues. However it should be able to run most of the games.

Features:

- SM83 CPU with debugger
- APU
- PPU with color support
- MBC1, MBC3, MBC5
- RTC
- Gamepad
- Timer
- DMA, HDMA
- Speed switch (required for CGB)
- SRAM savefiles using IndexedDB, which should be compatible other emulators
- Game state serialization
- Loading arbitrary ROMs from the browser

## Running

Visit https://yoo2001818.github.io/gb-emulator-js/ to run the emulator. You
need to bring your own ROMs.

In order to run the project locally, clone the repository and run `npm install`
then `npm start`. The project should open automatically.
