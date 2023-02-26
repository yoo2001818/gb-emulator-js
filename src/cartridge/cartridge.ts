import { CPU } from "../cpu/cpu";
import { CartridgeInfo, readCartridgeInfo } from "./info";
import { MemoryBankController } from "./mbc/mbc";
import { MBC1 } from "./mbc/mbc1";
import { MBC3 } from "./mbc/mbc3";
import { MBC5 } from "./mbc/mbc5";
import { MBCType } from "./mbcType";

export interface Cartridge {
  info: CartridgeInfo;
  mbc: MemoryBankController;
}

function createSRAM(size: number): Uint8Array | null {
  if (size === 0) return null;
  return new Uint8Array(size);
}

export async function loadCartridge(cpu: CPU, rom: Uint8Array): Promise<Cartridge> {
  const info = await readCartridgeInfo(rom);
  const ram = createSRAM(info.ramSize);
  // Note that we don't perform any I/O here
  switch (info.cartridgeType.mbcType) {
    case MBCType.ROM:
      return { info, mbc: new MBC3(rom, ram, cpu, info.cartridgeType.hasTimer) };
    case MBCType.MBC1:
      return { info, mbc: new MBC1(rom, ram) };
    case MBCType.MBC3:
      return { info, mbc: new MBC3(rom, ram, cpu, info.cartridgeType.hasTimer) };
    case MBCType.MBC5:
      return { info, mbc: new MBC5(rom, ram) };
    default:
      console.log(info);
      throw new Error('This cartridge is not supported yet');
  }
}
