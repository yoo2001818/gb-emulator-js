import { CartridgeInfo } from '../cartridge/info';

export enum SystemType {
  DMG,
  CGB,
  SGB,
}

export const SYSTEM_BOOT_REGISTERS: Record<SystemType, number[]> = {
  [SystemType.DMG]: [0x01, 0, 0x13, 0, 0xd8, 0xb0, 0x01, 0x4d, 0, 0xfffe],
  [SystemType.CGB]: [0x11, 0, 0x13, 0, 0xd8, 0xb0, 0x01, 0x4d, 0, 0xfffe],
  [SystemType.SGB]: [0x01, 0, 0x13, 0, 0xd8, 0xb0, 0x01, 0x4d, 0, 0xfffe],
};

export function getSystemType(cartridgeInfo: CartridgeInfo): SystemType {
  if (cartridgeInfo.supportsCGB) return SystemType.CGB;
  return SystemType.DMG;
}
