import { describe, expect, it } from "vitest";
import { uuidV5 } from "./uuid-v5";

const DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

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
