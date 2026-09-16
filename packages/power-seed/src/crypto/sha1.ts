import { rotateLeft } from "./rotate-left";

/** Inline for the same reason as `uuidV5`: it has to be synchronous and portable. */
export function sha1(message: Uint8Array): Uint8Array {
  const bitLength = message.length * 8;
  const paddedLength = Math.ceil((message.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  const view = new DataView(padded.buffer);

  padded.set(message);
  padded[message.length] = 0x80;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Int32Array(80);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index++) {
      words[index] = view.getInt32(offset + index * 4);
    }

    for (let index = 16; index < 80; index++) {
      const w3 = words[index - 3] ?? 0;
      const w8 = words[index - 8] ?? 0;
      const w14 = words[index - 14] ?? 0;
      const w16 = words[index - 16] ?? 0;

      words[index] = rotateLeft(w3 ^ w8 ^ w14 ^ w16, 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let index = 0; index < 80; index++) {
      let f: number;
      let k: number;

      if (index < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (index < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (index < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }

      const next = (rotateLeft(a, 5) + f + e + k + (words[index] ?? 0)) | 0;

      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = next;
    }

    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const digest = new Uint8Array(20);
  const out = new DataView(digest.buffer);

  out.setUint32(0, h0 >>> 0);
  out.setUint32(4, h1 >>> 0);
  out.setUint32(8, h2 >>> 0);
  out.setUint32(12, h3 >>> 0);
  out.setUint32(16, h4 >>> 0);

  return digest;
}
