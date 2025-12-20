import { describe, expect, it } from "vitest";
import createLazyObjectDefault, { lazy, lazyAssign } from "./index";

describe("basic", () => {
  it("should run a test", () => {
    expect(true).toBe(true);
  });

  it("should expose correct exports", () => {
    expect(createLazyObjectDefault).toBe(lazy);
    expect(lazyAssign).toBeDefined();
  });
});
