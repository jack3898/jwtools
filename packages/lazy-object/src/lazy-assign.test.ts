import { describe, expect, it, vi } from "vitest";
import { lazyAssign } from "./lazy-assign";

describe("injectLazyProp", () => {
  it("should inject a new lazy prop into an existing object", () => {
    const getter = vi.fn().mockImplementation(() => "there");
    const normalObject = { test: "hello" };

    lazyAssign(normalObject, "test2", () => getter());

    normalObject.test2;

    expect(normalObject.test2).toBe("there");
    expect(getter).toHaveBeenCalledOnce();
  });

  it("should support more than one injected property", () => {
    const normalObject = { test: "hello" };

    lazyAssign(normalObject, "test2", () => "there");
    lazyAssign(normalObject, "test3", () => "mate");

    expect(normalObject.test2).toBe("there");
    expect(normalObject.test3).toBe("mate");
  });

  it("should overwrite an existing property", () => {
    const normalObject = { test: "hello" };

    lazyAssign(normalObject, "test", () => "there");

    expect(normalObject.test).toBe("there");
  });

  it("should persist the result of the getter", () => {
    const getter = vi.fn().mockReturnValue(crypto.randomUUID());
    const normalObject = {};

    lazyAssign(normalObject, "test", getter);

    normalObject.test;
    normalObject.test;

    expect(getter).toHaveBeenCalledOnce();
    expect(normalObject.test).toBe(normalObject.test);
  });
});

describe("injectLazyProp options", () => {
  describe("onAccess", () => {
    it("should run the onAccess callback when a property has been accessed", () => {
      const onAccess = vi.fn();
      const normalObject = {};

      lazyAssign(normalObject, "test", () => "value", { onAccess });

      normalObject.test;

      expect(onAccess).toHaveBeenCalledWith("test");
    });

    it("should allow no options to be passed in", () => {
      const normalObject = {};

      lazyAssign(normalObject, "test", () => "value");

      expect(normalObject.test).toBe("value");
    });

    it("should allow passing an empty object", () => {
      const normalObject = {};

      lazyAssign(normalObject, "test", () => "value", {});

      expect(normalObject.test).toBe("value");
    });
  });
});
