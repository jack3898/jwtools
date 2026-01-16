import { describe, expect, it, vi } from "vitest";
import { lazy } from "./lazy";

describe("createLazyObject", () => {
  it("should get a property", () => {
    const value = true;

    const lazyObject = lazy({ test: () => value });

    expect(lazyObject.test).toBe(value);
  });

  it("should set a property", () => {
    const object = true;
    const setted = false;

    const lazyObject = lazy({ test: () => object });

    lazyObject.test = setted;

    expect(lazyObject.test).toBe(setted);
  });

  it("should cache getting a property", () => {
    const getter = vi.fn().mockImplementation(() => crypto.randomUUID());

    const lazyObject = lazy({ test: getter });

    const result1 = lazyObject.test;
    const result2 = lazyObject.test;

    expect(getter).toHaveBeenCalledOnce();

    expect(result1 === result2).toBe(true);
  });

  it("should check if a the object has a property", () => {
    const lazyObject = lazy({ test: () => false });

    expect("test" in lazyObject).toBe(true);
  });

  it("should pre-compute the value when checking if a property exists", () => {
    const getter = vi.fn();
    const lazyObject = lazy({ test: () => getter() });

    expect("test" in lazyObject).toBe(true);

    expect(getter).not.toHaveBeenCalled();

    lazyObject.test;

    expect(getter).toHaveBeenCalledOnce();
  });

  it("should get the keys of the lazy object", () => {
    const lazyObject = lazy({
      test: () => true,
      test2: () => false,
    });

    expect(Object.keys(lazyObject)).toEqual(["test", "test2"]);
  });

  it("should get the values for the lazy object", () => {
    const lazyObject = lazy({
      test: () => true,
      test2: () => false,
    });

    expect(Object.values(lazyObject)).toEqual([true, false]);
  });

  it("should delete a property from the cache", () => {
    const getter = vi.fn();

    const lazyObject = lazy({
      test: () => getter(),
    });

    lazyObject.test;

    delete lazyObject.test;

    lazyObject.test;

    expect(getter).toHaveBeenCalledOnce();
  });

  it("should represent an object if it's used in whole", () => {
    const lazyObject = lazy({
      test: () => true,
      test2: () => false,
      test3: () => ({ key: "value" }),
      test4: () => undefined,
    });

    expect(lazyObject).toEqual({
      test: true,
      test2: false,
      test3: { key: "value" },
      test4: undefined,
    });
  });

  it("should allow a merge with a custom object", () => {
    const lazyObject = lazy({ test: () => true }, { test2: false });

    expect(lazyObject).toEqual({
      test: true,
      test2: false,
    });
  });

  it("should not mutate the objected merged with, and return a new object", () => {
    const mergeWith = { test2: false };
    const lazyObject = lazy({}, mergeWith);

    expect(lazyObject).not.toBe(mergeWith);
  });

  it("should still not run the lazy function even when a merge happened", () => {
    const getter = vi.fn();
    const lazyObject = lazy({ test: () => getter() }, { test2: false });

    expect(lazyObject.test2).toBe(false);
    expect(getter).not.toHaveBeenCalled();

    lazyObject.test;

    expect(getter).toHaveBeenCalledOnce();
  });
});
