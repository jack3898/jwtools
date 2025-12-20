import { describe, expect, it, vi } from "vitest";
import createLazyObjectDefault, {
  createLazyObject,
  injectLazyProp,
} from "./index";

describe("basic", () => {
  it("should run a test", () => {
    expect(true).toBe(true);
  });

  it("should expose correct exports", () => {
    expect(createLazyObjectDefault).toBe(createLazyObject);
    expect(injectLazyProp).toBeDefined();
  });
});
