export function rotateLeft(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}
