/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest — they are verified by `tsc --noEmit` (the
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
    languages: ["en", "jp"],
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
    createTranslationConfig({ languages: ["en", "jp"] });
  });

  it("requires `default` to be a declared language", () => {
    createTranslationConfig({ languages: ["en", "jp"], default: "en" });

    // @ts-expect-error - "fr" is not one of the declared languages.
    createTranslationConfig({ languages: ["en", "jp"], default: "fr" });
  });
});
