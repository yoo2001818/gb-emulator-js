import { RTCData } from './rtc';

export function saveRTC(rtc: RTCData, output: Uint8Array, offset: number): void {
  output[offset] = rtc.seconds;
  output[offset + 4] = rtc.minutes;
  output[offset + 8] = rtc.hours;
  output[offset + 12] = rtc.days & 0xff;
  output[offset + 16] = (rtc.days >> 8) & 0xff;
  output[offset + 20] = rtc.seconds;
  output[offset + 24] = rtc.minutes;
  output[offset + 28] = rtc.hours;
  output[offset + 32] = rtc.days & 0xff;
  output[offset + 36] = (rtc.days >> 8) & 0xff;
  const view = new DataView(output.buffer, output.byteOffset + offset);
  const date = Math.floor(Date.now() / 1000);
  view.setUint32(40, date % 0x100000000, true);
  view.setUint32(44, Math.floor(date / 0x100000000), true);
}

export function loadRTC(input: Uint8Array, offset: number): RTCData {
  if (offset + 48 > input.length) {
    return { seconds: 0, minutes: 0, hours: 0, days: 0, halted: false };
  }
  const oldSeconds = input[offset];
  const oldMinutes = input[offset + 4];
  const oldHours = input[offset + 8];
  const oldDays = input[offset + 12] | (input[offset + 16] << 8);
  const view = new DataView(input.buffer, input.byteOffset + offset);
  const dateBefore = view.getUint32(40, true) + (view.getUint32(44, true) * 0x100000000);
  const dateDiff = Math.floor(Date.now() / 1000) - dateBefore;
  // Increment the time
  const seconds = oldSeconds + dateDiff;
  const minutes = oldMinutes + Math.floor(seconds / 60);
  const hours = oldHours + Math.floor(minutes / 60);
  const days = oldDays + Math.floor(hours / 24);
  return {
    seconds: seconds % 60,
    minutes: minutes % 60,
    hours: hours % 24,
    days: days,
    halted: false,
  };
}
