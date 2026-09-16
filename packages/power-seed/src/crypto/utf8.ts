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
