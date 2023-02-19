import { CartridgeType, CARTRIDGE_TYPES } from "./cartridgeType";
import { MBCType } from "./mbcType";

export interface CartridgeInfo {
  title: string;
  supportsCGB: boolean;
  requiresCGB: boolean;
  supportsSGB: boolean;
  cartridgeType: CartridgeType;
  romBanks: number;
  romSize: number;
  ramBanks: number;
  ramSize: number;
  sha1Sum: string;
}

const RAM_BANKS = [0, 0, 1, 4, 16, 8];

export async function readCartridgeInfo(bytes: Uint8Array): Promise<CartridgeInfo> {
  // 0134 - 0143 Title
  // 0143 - CGB flag
  // 0146 - SGB flag
  // 0147 - Cartridge type
  // 0148 - ROM size
  // 0149 - RAM size
  const titleBytes: string[] = [];
  for (let i = 0; i < 16; i += 1) {
    const byte = bytes[0x134 + i];
    if (byte === 0 || byte >= 0x80) break;
    titleBytes.push(String.fromCharCode(byte));
  }
  const title = titleBytes.join('');

  const cgbFlag = bytes[0x143];
  const supportsCGB = (cgbFlag & 0x80) !== 0;
  const requiresCGB = (cgbFlag & 0x40) !== 0;
  const supportsSGB = bytes[0x146] === 0x3;

  const cartridgeType = CARTRIDGE_TYPES[bytes[0x147]];
  if (cartridgeType == null) {
    throw new Error(`Unknown cartridge type ${bytes[0x147].toString(16)}`);
  }

  const romBanks = 2 << bytes[0x148];
  const romSize = 16 * 1024 * romBanks;

  let ramBanks = RAM_BANKS[bytes[0x149]];
  let ramSize = 8 * 1024 * ramBanks;
  // MBC2 has 4Kbytes of RAM internally
  if (cartridgeType.mbcType === MBCType.MBC2) {
    ramBanks = 1;
    ramSize = 4 * 1024;
  }

  // Run sha1 digestion using crypto API
  const hash = await crypto.subtle.digest('SHA-1', bytes);
  const hashBuf = new Uint8Array(hash);
  const sha1Sum = Array.from(hashBuf).map((v) => v.toString(16).padStart(2, '0')).join('');

  return {
    title,
    supportsCGB,
    requiresCGB,
    supportsSGB,
    cartridgeType,
    romBanks,
    romSize,
    ramBanks,
    ramSize,
    sha1Sum,
  };
}
