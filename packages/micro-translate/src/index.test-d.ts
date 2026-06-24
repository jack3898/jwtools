/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest — they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { expectTypeOf } from "expect-type";
import {
  $,
  createTranslationConfig,
  msg,
  plural,
  type Translation,
  type Translator,
} from ".";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

// Flattens an intersection (e.g. `{ a } & { b }`) into a single object literal
// so structural equality reads naturally. The library builds multi-parameter
// dicts as intersections internally; this is purely cosmetic for the assertion.
type Prettify<T> = { [K in keyof T]: T[K] };

describe("msg", () => {
  it("infers a single named parameter", () => {
    const greet = msg`Hey ${"name"}`;

    expectTypeOf(greet).parameter(0).toEqualTypeOf<{ name: string | number }>();
    expectTypeOf(greet).returns.toEqualTypeOf<string>();
  });

  it("infers multiple named parameters", () => {
    const greet = msg`${"greeting"}, ${"name"}!`;

    expectTypeOf<Prettify<Parameters<typeof greet>[0]>>().toEqualTypeOf<{
      greeting: string | number;
      name: string | number;
    }>();
  });

  it("infers a numeric index as a string parameter", () => {
    const message = msg`You have ${0} new messages`;

    expectTypeOf(message).parameter(0).toEqualTypeOf<{ 0: string | number }>();
  });

  it("infers positional `$` placeholders as a string index signature", () => {
    const sentence = msg`${$} and ${$}`;

    expectTypeOf(sentence)
      .parameter(0)
      .toEqualTypeOf<{ [index: number]: string }>();

    // An array of strings satisfies the index signature.
    expectTypeOf<string[]>().toExtend<{ [index: number]: string }>();
  });

  it("infers no parameters for a plain template", () => {
    const plain = msg`Just text`;

    expectTypeOf(plain).parameter(0).toEqualTypeOf<Record<never, never>>();

    // An empty object is accepted.
    plain({});
  });

  it("infers a plural parameter as a number under its literal name", () => {
    const count = msg`${plural("count", { one: "file", other: "files" })}`;

    expectTypeOf(count).parameter(0).toEqualTypeOf<{ count: number }>();
  });

  it("combines named and plural parameters", () => {
    const summary = msg`${"name"} has ${plural("count", {
      one: "1 file",
      other: "many files",
    })}`;

    expectTypeOf<Prettify<Parameters<typeof summary>[0]>>().toEqualTypeOf<{
      name: string | number;
      count: number;
    }>();
  });

  it("rejects a missing parameter", () => {
    const greet = msg`Hey ${"name"}`;

    // @ts-expect-error - `name` is required.
    greet({});
  });

  it("rejects a parameter of the wrong type", () => {
    const greet = msg`Hey ${"name"}`;

    // @ts-expect-error - `name` must be a string | number, not a boolean.
    greet({ name: true });
  });
});

describe("plural", () => {
  it("requires the `other` variant", () => {
    // @ts-expect-error - `other` is the mandatory fallback variant.
    plural("count", { one: "file" });
  });

  it("only allows valid CLDR plural categories", () => {
    // @ts-expect-error - `lots` is not a plural category.
    plural("count", { other: "files", lots: "many" });
  });
});

describe("createTranslationConfig", () => {
  const define = createTranslationConfig({ languages: ["en", "jp"] });
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

describe("Translator", () => {
  const define = createTranslationConfig({ languages: ["en", "jp"] });
  const t = define({ submit: { en: "Submit", jp: "Submitto" } });

  it("types the result of `define(...)`", () => {
    // The concrete translator is assignable to the general `Translator` type.
    expectTypeOf(t).toExtend<Translator>();
  });

  it("can be narrowed to a pinned locale union in a wrapper", () => {
    type Locale = "en" | "jp";

    // Mirrors the `useTranslation` pattern from the docstring: pin the locale,
    // infer the resolved translations, keep the keys without an assertion.
    function useTranslation<T>(translator: (locale: Locale) => T): T {
      return translator("en");
    }

    const translations = useTranslation(t);

    expectTypeOf(translations.submit).toEqualTypeOf<"Submit" | "Submitto">();
  });
});

describe("Translation", () => {
  const define = createTranslationConfig({ languages: ["en", "jp"] });
  const translator = define({
    submit: { en: "Submit", jp: "Submitto" },
    welcome: { en: msg`Hey ${"name"}`, jp: msg`Konnichiwa ${"name"}` },
  });

  it("is the union of resolved values across every locale", () => {
    type T = Translation<typeof translator>;

    expectTypeOf<T["submit"]>().toEqualTypeOf<"Submit" | "Submitto">();
    expectTypeOf<T["welcome"]>().toEqualTypeOf<
      (dict: { name: string | number }) => string
    >();
  });
});
