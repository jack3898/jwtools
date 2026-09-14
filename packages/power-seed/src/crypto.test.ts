import { describe, expect, it } from "vitest";
import { sha1, uuidV5 } from "./crypto";

const DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/** ASCII only, so the bytes are the code units. */
function ascii(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

describe("sha1", () => {
  it("matches the published test vectors", () => {
    expect(hex(sha1(ascii("")))).toBe(
      "da39a3ee5e6b4b0d3255bfef95601890afd80709",
    );
    expect(hex(sha1(ascii("abc")))).toBe(
      "a9993e364706816aba3e25717850c26c9cd0d89d",
    );
    // 56 bytes: the length no longer fits the first block, so two are hashed.
    expect(
      hex(
        sha1(ascii("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")),
      ),
    ).toBe("84983e441c3bd26ebaae4aa1f95129e5e54670f1");
  });

  it("agrees with node's crypto across block boundaries", () => {
    // Digests of `index % 251` byte runs, computed with node:crypto once.
    const vectors: ReadonlyArray<readonly [number, string]> = [
      [55, "8ae2d46729cfe68ff927af5eec9c7d1b66d65ac2"],
      [56, "636e2ec698dac903498e648bd2f3af641d3c88cb"],
      [63, "6d942da0c4392b123528f2905c713a3ce28364bd"],
      [64, "c6138d514ffa2135bfce0ed0b8fac65669917ec7"],
      [65, "69bd728ad6e13cd76ff19751fde427b00e395746"],
      [119, "41c89d06001bab4ab78736b44efe7ce18ce6ae08"],
      [120, "d3dbd653bd8597b7475321b60a36891278e6a04a"],
      [1000, "c9c960a0b925474fab83942cc27d504fc24ac37b"],
    ];

    for (const [length, digest] of vectors) {
      const message = new Uint8Array(length).map((_, index) => index % 251);

      expect(hex(sha1(message))).toBe(digest);
    }
  });
});

describe("uuidV5", () => {
  it("matches the RFC 4122 example", () => {
    expect(uuidV5("www.example.com", DNS)).toBe(
      "2ed6657d-e927-568b-95e1-2665a8aea6a2",
    );
  });

  it("encodes names as UTF-8, like the uuid package", () => {
    // Computed with the `uuid` package's v5 once, so non-ASCII names stay
    // compatible with ids minted before this implementation.
    const vectors: ReadonlyArray<readonly [string, string]> = [
      ["plain", "dfeb39a7-e2c8-5d06-a30c-ea0d40897d29"],
      ["héllo", "5ca283f8-ff14-58cb-ba86-bf52120a3414"],
      ["日本語", "9786f370-913c-51ea-845e-7f3469bc5966"],
      ["emoji 🌍", "c65f7bdd-5641-5284-9836-29cb8d363a6d"],
      ["tenants:x#0", "ae1b430c-31b6-5fae-aabf-fd49b199ec66"],
    ];

    for (const [name, expected] of vectors) {
      expect(uuidV5(name, DNS)).toBe(expected);
    }
  });

  it("rejects a namespace that is not a UUID", () => {
    expect(() => uuidV5("x", "not-a-uuid")).toThrow(
      '"not-a-uuid" is not a UUID',
    );
  });
});
