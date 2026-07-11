/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest — they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { expectTypeOf } from "expect-type";
import { createTranslationConfig, msg, ref, todo } from ".";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

describe("ref", () => {
  const { define } = createTranslationConfig({
    languages: { en: {}, "en-gb": {}, fr: {} },
    default: "en",
  });

  it("resolves to the target's resolved type (a plain string)", () => {
    const t = define({
      carPark: { en: "Parking lot", "en-gb": "Car park", fr: ref("en") },
    });

    // `fr` is identity-mapped to `en`'s literal.
    expectTypeOf(t("fr").carPark).toEqualTypeOf<"Parking lot">();
    expectTypeOf(t("en-gb").carPark).toEqualTypeOf<"Car park">();
  });

  it("resolves to the target's resolved type (a template)", () => {
    const t = define({
      welcome: {
        en: msg`Hey ${"name"}`,
        "en-gb": ref("en"),
        fr: ref("en"),
      },
    });

    expectTypeOf(t("fr").welcome).toEqualTypeOf<
      (dict: { name: string | number }) => string
    >();
  });

  it("rejects a target that is not a sibling (Rule 1)", () => {
    define({
      greeting: {
        en: "Hi",
        // @ts-expect-error - Rule 1: "de" is not a sibling locale.
        "en-gb": ref("de"),
        fr: ref("en"),
      },
    });
  });

  it("rejects a target that is itself a ref() (Rule 2)", () => {
    define({
      submit: {
        en: "Submit",
        "en-gb": ref("en"),
        // @ts-expect-error - Rule 2: "en-gb" is itself a ref().
        fr: ref("en-gb"),
      },
    });
  });
});

describe("todo", () => {
  const { define } = createTranslationConfig({
    languages: { en: {}, "en-gb": {}, fr: {} },
    default: "en",
  });

  it("resolves to the default locale's resolved type", () => {
    const t = define({
      welcome: {
        en: msg`Hey ${"name"}`,
        "en-gb": ref("en"),
        fr: todo(),
      },
    });

    expectTypeOf(t("fr").welcome).toEqualTypeOf<
      (dict: { name: string | number }) => string
    >();
  });

  it("rejects being used on the default locale (Rule 3)", () => {
    define({
      greeting: {
        // @ts-expect-error - Rule 3: todo() on the default locale targets itself.
        en: todo(),
        "en-gb": "Hi",
        fr: "Salut",
      },
    });
  });
});
