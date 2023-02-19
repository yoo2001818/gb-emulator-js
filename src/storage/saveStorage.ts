import localforage from 'localforage';
import { CartridgeInfo } from '../cartridge/info';

interface SaveDataFormat {
  title: string;
  data: Uint8Array;
}

export async function readSaveStorage(cartInfo: CartridgeInfo): Promise<Uint8Array | null> {
  const key = `save-${cartInfo.sha1Sum}`;
  const save = await localforage.getItem(key) as SaveDataFormat | null;
  if (save == null) return null;
  return save.data;
}

export async function writeSaveStorage(cartInfo: CartridgeInfo, data: Uint8Array): Promise<void> {
  const key = `save-${cartInfo.sha1Sum}`;
  const save: SaveDataFormat = {
    title: cartInfo.title,
    data,
  };
  await localforage.setItem(key, save);
}
