import { MBCType } from './mbcType';

export interface CartridgeType {
  mbcType: MBCType;
  hasRAM: boolean;
  hasBattery: boolean;
  hasTimer: boolean;
  hasRumble: boolean;
  hasSensor: boolean;
}

export function createCartridgeType(
  mbcType: MBCType,
  hasRAM: boolean = false,
  hasBattery: boolean = false,
  hasTimer: boolean = false,
  hasRumble: boolean = false,
  hasSensor: boolean = false,
): CartridgeType {
  return {
    mbcType,
    hasRAM,
    hasBattery,
    hasTimer,
    hasRumble,
    hasSensor,
  };
}

/* eslint-disable no-useless-computed-key */
export const CARTRIDGE_TYPES: Record<number, CartridgeType | null> = {
  [0x00]: createCartridgeType(MBCType.ROM),
  [0x01]: createCartridgeType(MBCType.MBC1),
  [0x02]: createCartridgeType(MBCType.MBC1, true),
  [0x03]: createCartridgeType(MBCType.MBC1, true, true),
  [0x05]: createCartridgeType(MBCType.MBC2, true),
  [0x06]: createCartridgeType(MBCType.MBC2, true, true),
  [0x08]: createCartridgeType(MBCType.ROM, true),
  [0x09]: createCartridgeType(MBCType.ROM, true, true),
  [0x0b]: createCartridgeType(MBCType.MMM01),
  [0x0c]: createCartridgeType(MBCType.MMM01, true),
  [0x0d]: createCartridgeType(MBCType.MMM01, true, true),
  [0x0f]: createCartridgeType(MBCType.MBC3, false, true, true),
  [0x10]: createCartridgeType(MBCType.MBC3, true, true, true),
  [0x11]: createCartridgeType(MBCType.MBC3),
  [0x12]: createCartridgeType(MBCType.MBC3, true),
  [0x13]: createCartridgeType(MBCType.MBC3, true, true),
  [0x19]: createCartridgeType(MBCType.MBC5),
  [0x1a]: createCartridgeType(MBCType.MBC5, true),
  [0x1b]: createCartridgeType(MBCType.MBC5, true, true),
  [0x1c]: createCartridgeType(MBCType.MBC5, false, false, false, true),
  [0x1d]: createCartridgeType(MBCType.MBC5, true, false, false, true),
  [0x1e]: createCartridgeType(MBCType.MBC5, true, true, false, true),
  [0x20]: createCartridgeType(MBCType.MBC6),
  [0x22]: createCartridgeType(MBCType.MBC7, true, true, false, true, true),
  [0xfc]: createCartridgeType(MBCType.POCKET_CAMERA),
  [0xfd]: createCartridgeType(MBCType.BANDAI_TAMA5),
  [0xfe]: createCartridgeType(MBCType.HUC3),
  [0xff]: createCartridgeType(MBCType.HUC1, true, true),
};
/* eslint-enable no-useless-computed-key */
