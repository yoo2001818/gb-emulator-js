export function getHex16(n: number): string {
  return '$' + (n.toString(16).padStart(4, '0'));
}

export function getHex8(n: number): string {
  return '$' + (n.toString(16).padStart(2, '0'));
}
