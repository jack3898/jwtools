/**
 * RFC 4122 version 5 UUIDs (SHA-1, name based), implemented inline so the
 * package needs neither the `uuid` package nor a runtime-specific crypto API.
 * `crypto.subtle` is asynchronous and Node's `crypto` is Node only, and id
 * derivation has to be synchronous and portable.
 */

const HEX = /^[0-9a-f]{32}$/i;

function bytesOfUuid(uuid: string): Uint8Array {
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

/** UTF-8, inline: `TextEncoder` is not part of the ES lib and this has to run anywhere. */
export function utf8(text: string): Uint8Array {
  const bytes: Array<number> = [];

  for (const char of text) {
    let point = char.codePointAt(0) ?? 0;

    // A lone surrogate is not a character. Encode the replacement character
    // instead, as TextEncoder does.
    if (point >= 0xd800 && point <= 0xdfff) {
      point = 0xfffd;
    }

    if (point < 0x80) {
      bytes.push(point);
    } else if (point < 0x800) {
      bytes.push(0xc0 | (point >> 6), 0x80 | (point & 0x3f));
    } else if (point < 0x1_0000) {
      bytes.push(
        0xe0 | (point >> 12),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (point >> 18),
        0x80 | ((point >> 12) & 0x3f),
        0x80 | ((point >> 6) & 0x3f),
        0x80 | (point & 0x3f),
      );
    }
  }

  return Uint8Array.from(bytes);
}

function rotateLeft(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}

/** Plain SHA-1 over a byte array. Roughly 40 lines, and it never changes. */
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

function formatUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * A UUID that is a pure function of `name` within `namespace`, so the same
 * identity always yields the same id. Compatible with `uuid`'s `v5`.
 */
export function uuidV5(name: string, namespace: string): string {
  const namespaceBytes = bytesOfUuid(namespace);
  const nameBytes = utf8(name);
  const input = new Uint8Array(namespaceBytes.length + nameBytes.length);

  input.set(namespaceBytes);
  input.set(nameBytes, namespaceBytes.length);

  const hash = sha1(input);

  // Version 5 in the high nibble of byte 6, RFC 4122 variant in byte 8.
  hash[6] = ((hash[6] ?? 0) & 0x0f) | 0x50;
  hash[8] = ((hash[8] ?? 0) & 0x3f) | 0x80;

  return formatUuid(hash);
}
