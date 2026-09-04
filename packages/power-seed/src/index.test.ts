import { describe, expect, it } from "vitest";
import { VERSION } from "./index";

describe("basic", () => {
  it("should expose correct exports", () => {
    expect(VERSION).toBeTypeOf("string");
  });
});
