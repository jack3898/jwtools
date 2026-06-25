/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest — they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { expectTypeOf } from "expect-type";
import { createTranslationConfig, msg, ordinal } from ".";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

describe("ordinal", () => {
  it("infers a number parameter under its name", () => {
    const place = msg`You came ${ordinal("place")}`;

    expectTypeOf(place).parameter(0).toEqualTypeOf<{ place: number }>();
  });

  it("resolves to a clean template function (marker stripped)", () => {
    const define = createTranslationConfig({
      languages: ["en"],
      default: "en",
      ordinals: { en: { other: "th" } },
    });
    const t = define({ place: { en: msg`${ordinal("place")}` } });

    expectTypeOf(t("en").place).toEqualTypeOf<
      (dict: { place: number }) => string
    >();
  });

  it("rejects ordinal() when `ordinals` is not configured", () => {
    const define = createTranslationConfig({
      languages: ["en"],
      default: "en",
    });

    define({
      // @ts-expect-error - ordinal() requires `ordinals` in the config.
      place: { en: msg`${ordinal("place")}` },
    });
  });

  it("requires `ordinals` to cover every language", () => {
    createTranslationConfig({
      languages: ["en", "ja"],
      default: "en",
      // @ts-expect-error - `ja` is missing from `ordinals`.
      ordinals: { en: { other: "th" } },
    });
  });

  it("requires the `other` suffix in an ordinals entry", () => {
    createTranslationConfig({
      languages: ["en"],
      default: "en",
      // @ts-expect-error - `other` is the required fallback.
      ordinals: { en: { one: "st" } },
    });
  });
});
