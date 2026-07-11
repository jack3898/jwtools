/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest; they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { expectTypeOf } from "expect-type";
import {
  createTranslationConfig,
  msg,
  type Translation,
  type Translator,
} from ".";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

describe("Translator", () => {
  const { define } = createTranslationConfig({
    languages: { en: {}, jp: {} },
    default: "en",
  });
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
  const { define } = createTranslationConfig({
    languages: { en: {}, jp: {} },
    default: "en",
  });
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
