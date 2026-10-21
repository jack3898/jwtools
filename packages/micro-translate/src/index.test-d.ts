/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest; they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { expectTypeOf } from "expect-type";
import { createTranslationConfig, msg } from ".";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

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

  it("resolves a plain string to its literal type per locale", () => {
    expectTypeOf(t("en").submit).toEqualTypeOf<"Submit">();
    expectTypeOf(t("jp").submit).toEqualTypeOf<"Submitto">();
  });

  it("resolves a template to its parameterised function", () => {
    expectTypeOf(t("en").welcome).toEqualTypeOf<
      (dict: { name: string | number }) => string
    >();
  });

  it("constrains the locale to the configured languages", () => {
    t("en");
    t("jp");

    // @ts-expect-error - "fr" was not configured.
    t("fr");
  });

  it("requires every configured language for each key", () => {
    define({
      // @ts-expect-error - `jp` is missing.
      submit: { en: "Submit" },
    });
  });

  it("KNOWN GAP: does not reject keys with an unknown language", () => {
    // `de` was never configured, yet this compiles. Because `define` checks its
    // argument by *assignability* against `Record<Language, ...>`, extra locale
    // keys are tolerated rather than flagged. A stricter, exact constraint would
    // turn this into an error — see the note returned to the maintainer.
    define({
      submit: { en: "Submit", jp: "Submitto", de: "Senden" },
    });
  });

  it("exposes only the declared keys", () => {
    expectTypeOf(t("en")).toHaveProperty("submit");
    expectTypeOf(t("en")).toHaveProperty("welcome");

    // @ts-expect-error - `missing` is not a declared key.
    t("en").missing;
  });
});

describe("config default", () => {
  it("requires `default` to be provided", () => {
    // @ts-expect-error - `default` is required.
    createTranslationConfig({ languages: { en: {}, jp: {} } });
  });

  it("requires `default` to be a declared language", () => {
    createTranslationConfig({ languages: { en: {}, jp: {} }, default: "en" });

    // @ts-expect-error - "fr" is not one of the declared languages.
    createTranslationConfig({ languages: { en: {}, jp: {} }, default: "fr" });
  });
});

describe("runtime context", () => {
  type Context = { currency: string };

  const { define, tool } = createTranslationConfig<Context>()({
    languages: { en: {}, jp: {} },
    default: "en",
  });
  const money = <const Name extends string>(name: Name) =>
    tool(name, (value: number, _locale, _config, context) => {
      expectTypeOf(context).toEqualTypeOf<Context>();

      return String(value);
    });
  const t = define({
    price: { en: msg`${money("amount")}`, jp: msg`${money("amount")}` },
    submit: { en: "Submit", jp: "Submitto" },
  });

  it("requires the context alongside the locale", () => {
    t("en", { currency: "GBP" });

    // @ts-expect-error - the context is required.
    t("en");

    // @ts-expect-error - the context must match the declared shape.
    t("en", { currency: 1 });

    // @ts-expect-error - the context is an exact object.
    t("en", { currency: "GBP", locale: "en" });
  });

  it("keeps the config's own inference", () => {
    expectTypeOf(
      t("jp", { currency: "JPY" }).submit,
    ).toEqualTypeOf<"Submitto">();
    expectTypeOf(t("en", { currency: "GBP" }).price).toEqualTypeOf<
      (dict: { amount: number }) => string
    >();

    // @ts-expect-error - "fr" was not configured.
    t("fr", { currency: "EUR" });

    define({
      // @ts-expect-error - `jp` is missing.
      submit: { en: "Submit" },
    });
  });

  it("types the translator with its context", () => {
    expectTypeOf<Parameters<typeof t>>().toEqualTypeOf<
      [locale: "en" | "jp", context: Context]
    >();
  });

  it("makes the context optional when it admits undefined", () => {
    const { define } = createTranslationConfig<Context | undefined>()({
      languages: { en: {} },
      default: "en",
    });
    const t = define({ submit: { en: "Submit" } });

    t("en");
    t("en", undefined);
    t("en", { currency: "GBP" });

    // @ts-expect-error - the context must still match the declared shape.
    t("en", { currency: 1 });
  });

  it("takes no context when none was declared", () => {
    const { define, tool } = createTranslationConfig({
      languages: { en: {} },
      default: "en",
    });
    const t = define({ submit: { en: "Submit" } });

    t("en");

    // @ts-expect-error - no context was declared.
    t("en", { currency: "GBP" });

    // The translator is exactly the locale-only function it was before.
    expectTypeOf<Parameters<typeof t>>().toEqualTypeOf<[locale: "en"]>();

    // @ts-expect-error - a recipe cannot read a context that was never declared.
    tool("a", (value: number, _locale, _config, _context) => String(value));
  });

  it("still requires a declared default in the context form", () => {
    createTranslationConfig<Context>()({
      languages: { en: {} },
      // @ts-expect-error - "fr" is not one of the declared languages.
      default: "fr",
    });
  });
});
