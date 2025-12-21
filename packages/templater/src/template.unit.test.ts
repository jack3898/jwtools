import { expect, it } from "vitest";

import { template } from "./template.js";

it("should template a string by itself", () => {
  const exec = template`${"test"}`;

  expect(exec({ test: "hello" })).toMatchInlineSnapshot(`"hello"`);
});

it("should template a string at the start", () => {
  const exec = template`${"test"} there`;

  expect(exec({ test: "hello" })).toMatchInlineSnapshot(`"hello there"`);
});

it("should work multiline", () => {
  const exec = template`
  This is a multiline test

  ${"multiline"}

  test
  `;

  expect(exec({ multiline: "line" })).toMatchInlineSnapshot(`
    "
      This is a multiline test

      line

      test
      "
  `);
});

it("should support multiple values", () => {
  const exec = template`${"one"} ${"two"} ${"three"} ${"four"}`;

  expect(
    exec({
      one: "juan",
      two: "too",
      three: "tree",
      four: "for",
    }),
  ).toMatchInlineSnapshot(`"juan too tree for"`);
});

it("shouldn't trim", () => {
  const exec = template` ${"one"} ${"two"} ${"three"} ${"four"} `;

  expect(
    exec({
      one: "juan",
      two: "too",
      three: "tree",
      four: "for",
    }),
  ).toMatchInlineSnapshot(`" juan too tree for "`);
});

it("should work with empty strings", () => {
  const exec = template` ${"one"}${"two"} ${"three"}${"four"} `;

  expect(
    exec({
      one: "",
      two: " ",
      three: "",
      four: "",
    }),
  ).toMatchInlineSnapshot(`"    "`);
});
