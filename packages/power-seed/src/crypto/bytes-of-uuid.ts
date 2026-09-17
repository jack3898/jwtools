const HEX = /^[0-9a-f]{32}$/i;

export function bytesOfUuid(uuid: string): Uint8Array {
  const hex = uuid.replaceAll("-", "");

  if (!HEX.test(hex)) {
    throw new Error(`"${uuid}" is not a UUID`);
  }

  const bytes = new Uint8Array(16);

  for (let index = 0; index < 16; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}
