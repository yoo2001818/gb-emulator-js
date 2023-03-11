import { Emulator } from '../system/emulator';

export interface IOEntry {
  read(emulator: Emulator): number;
  write(emulator: Emulator, value: number): void;
}

export const LCD_IO = {
  LCDC: {
    read: ({ lcd }) => lcd.lcdc,
    write: ({ lcd }, value) => {
      lcd.lcdc = value;
    },
  },
  STAT: {
    read: ({ lcd }) => {
      let bits = (lcd.stat & 0xf8);
      bits |= lcd.mode;
      if (lcd.ly === lcd.lyc) bits |= 4;
      return bits;
    },
    write: ({ lcd }, value) => {
      lcd.stat = value;
    },
  }
} satisfies Record<string, IOEntry>;

export const DMA_IO = {
} satisfies Record<string, IOEntry>;

export const HDMA_IO = {
} satisfies Record<string, IOEntry>;

export const CONTROLLER_IO = {
} satisfies Record<string, IOEntry>;
