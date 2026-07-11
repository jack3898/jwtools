import { describe, expect, it } from "vitest";
import { createTranslationConfig, msg } from ".";

describe("createTranslationConfig", () => {
  const { define } = createTranslationConfig({
    languages: { en: {}, jp: {} },
    default: "en",
  });
  const t = define({
    submit: {
      en: "Submit",
      jp: "Submitto",
    },
    welcome: {
      en: msg`Hey ${"name"}`,
      jp: msg`Konnichiwa ${"name"}`,
    },
  });

  it("resolves a plain string for the requested locale", () => {
    expect(t("en").submit).toBe("Submit");
    expect(t("jp").submit).toBe("Submitto");
  });

  it("resolves a template for the requested locale", () => {
    expect(t("en").welcome({ name: "World" })).toBe("Hey World");
    expect(t("jp").welcome({ name: "World" })).toBe("Konnichiwa World");
  });

  it("returns a fresh accessor per locale", () => {
    expect(t("en").submit).not.toBe(t("jp").submit);
  });

  it("returns undefined for an unknown key", () => {
    expect((t("en") as Record<string, unknown>).missing).toBeUndefined();
  });
});

describe("translator object behavior", () => {
  const { define } = createTranslationConfig({
    languages: { en: {}, jp: {} },
    default: "en",
  });
  const translator = define({
    submit: {
      en: "Submit",
      jp: "Submitto",
    },
    welcome: {
      en: msg`Hey ${"name"}`,
      jp: msg`Konnichiwa ${"name"}`,
    },
  });
  const t = translator("en");

  it("enumerates its keys with Object.keys", () => {
    expect(Object.keys(t)).toEqual(["submit", "welcome"]);
  });

  it("reports its keys to Reflect.ownKeys", () => {
    expect(Reflect.ownKeys(t)).toEqual(["submit", "welcome"]);
  });

  it("answers the `in` operator for known and unknown keys", () => {
    expect("submit" in t).toBe(true);
    expect("welcome" in t).toBe(true);
    expect("missing" in t).toBe(false);
  });

  it("spreads its resolved values into a plain object", () => {
    const spread = { ...t };

    expect(Object.keys(spread)).toEqual(["submit", "welcome"]);
    expect(spread.submit).toBe("Submit");
    expect(spread.welcome({ name: "World" })).toBe("Hey World");
  });

  it("serializes its plain-string values with JSON.stringify", () => {
    // Templates are functions, so JSON omits them — only `submit` survives.
    expect(JSON.stringify(t)).toBe('{"submit":"Submit"}');
  });

  it("iterates entries with Object.entries", () => {
    const entries = Object.fromEntries(Object.entries(t));

    expect(entries.submit).toBe("Submit");
    expect(typeof entries.welcome).toBe("function");
  });

  it("exposes an own, enumerable, configurable descriptor per key", () => {
    expect(Object.getOwnPropertyDescriptor(t, "submit")).toEqual({
      value: "Submit",
      writable: false,
      enumerable: true,
      configurable: true,
    });
  });

  it("has no descriptor for an unknown key", () => {
    expect(Object.getOwnPropertyDescriptor(t, "missing")).toBeUndefined();
  });

  it("returns undefined for symbol access instead of probing translations", () => {
    const asRecord = t as unknown as Record<PropertyKey, unknown>;

    expect(asRecord[Symbol.iterator]).toBeUndefined();
    expect(asRecord[Symbol.toPrimitive]).toBeUndefined();
    // A `then` probe (e.g. when accidentally awaited) must be absent.
    expect(asRecord.then).toBeUndefined();
  });
});
