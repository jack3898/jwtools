import { describe, expect, it } from "vitest";
import { msg } from ".";
import { tool } from "./tool";

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

describe("msg with rich (non-string) recipe output", () => {
  // Stands in for a framework element (React element, VNode, and so on).
  type El = { type: string; children: string };

  it("returns an array of chunks when a recipe renders a non-string", () => {
    const link = tool("terms", (render: (text: string) => El) =>
      render("the terms"),
    );
    const template = msg`Read ${link} before continuing`;

    expect(
      template({ terms: (text) => ({ type: "a", children: text }) }),
    ).toEqual([
      "Read ",
      { type: "a", children: "the terms" },
      " before continuing",
    ]);
  });

  it("keeps chunk order across multiple rich and plain interpolations", () => {
    const el = tool("icon", (v: string): El => ({ type: "img", children: v }));
    const template = msg`${"name"} ${el}!`;

    expect(template({ name: "Ada", icon: "star" })).toEqual([
      "Ada ",
      { type: "img", children: "star" },
      "!",
    ]);
  });

  it("drops empty string chunks in the rich path", () => {
    const el = tool("icon", (v: string): El => ({ type: "img", children: v }));
    const template = msg`${el}`;

    expect(template({ icon: "star" })).toEqual([
      { type: "img", children: "star" },
    ]);
  });

  it("joins to a string when a rich-capable recipe renders a string at runtime", () => {
    const maybeEl = tool("value", (v: string): El | string => v);
    const template = msg`Hello ${maybeEl}`;

    expect(template({ value: "world" })).toBe("Hello world");
  });
});
