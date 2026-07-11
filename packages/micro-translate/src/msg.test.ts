import { describe, expect, it } from "vitest";
import { msg } from ".";

describe("msg", () => {
  it("interpolates a single named parameter", () => {
    const greet = msg`Hey ${"name"}`;

    expect(greet({ name: "World" })).toBe("Hey World");
  });

  it("interpolates multiple named parameters", () => {
    const greet = msg`${"greeting"}, ${"name"}!`;

    expect(greet({ greeting: "Hi", name: "Ada" })).toBe("Hi, Ada!");
  });

  it("returns a template with no interpolation untouched", () => {
    const plain = msg`Just text`;

    expect(plain({})).toBe("Just text");
  });
});
