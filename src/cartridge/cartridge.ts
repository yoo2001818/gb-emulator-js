import { CartridgeInfo, readCartridgeInfo } from "./info";
import { MemoryBankController } from "./mbc/mbc";
import { MBC3 } from "./mbc/mbc3";
import { MBC5 } from "./mbc/mbc5";
import { MBCType } from "./mbcType";

export interface Cartridge {
  info: CartridgeInfo;
  mbc: MemoryBankController;
}

export async function loadCartridge(rom: Uint8Array): Promise<Cartridge> {
  const info = await readCartridgeInfo(rom);
  // Note that we don't perform any I/O here
  switch (info.cartridgeType.mbcType) {
    case MBCType.ROM:
      return { info, mbc: new MBC3(rom, new Uint8Array(info.ramSize)) };
    case MBCType.MBC3:
      return { info, mbc: new MBC3(rom, new Uint8Array(info.ramSize)) };
    case MBCType.MBC5:
      return { info, mbc: new MBC5(rom, new Uint8Array(info.ramSize)) };
    default:
      throw new Error('This cartridge is not supported yet');
  }
}
