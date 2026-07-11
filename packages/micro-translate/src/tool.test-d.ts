/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest; they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { expectTypeOf } from "expect-type";
import { createTranslationConfig, msg, type ToolKey } from ".";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

describe("tool", () => {
  it("infers V from the callback value annotation and preserves the key", () => {
    const { tool } = createTranslationConfig({
      languages: { en: {} },
      default: "en",
    });
    const place = tool("place", (v: number) => String(v));

    expectTypeOf(place).toEqualTypeOf<ToolKey<"place", number>>();
    expectTypeOf(msg`${place}`).parameter(0).toEqualTypeOf<{ place: number }>();
  });

  it("infers V as string, Date, string[] and object payloads", () => {
    const { tool } = createTranslationConfig({
      languages: { en: {} },
      default: "en",
    });
    const s = tool("a", (v: string) => v);
    const d = tool("a", (v: Date) => v.toISOString());
    const l = tool("a", (v: string[]) => v.join(","));
    const o = tool("a", (v: { id: number }) => String(v.id));

    expectTypeOf(msg`${s}`).parameter(0).toEqualTypeOf<{ a: string }>();
    expectTypeOf(msg`${d}`).parameter(0).toEqualTypeOf<{ a: Date }>();
    expectTypeOf(msg`${l}`).parameter(0).toEqualTypeOf<{ a: string[] }>();
    expectTypeOf(msg`${o}`).parameter(0).toEqualTypeOf<{ a: { id: number } }>();
  });

  it("supports progressive callback arity", () => {
    const { tool } = createTranslationConfig({
      languages: { en: {} },
      default: "en",
    });

    tool("a", (v: number) => String(v));
    tool("a", (v: number, locale) => `${v}${locale}`);
    tool("a", (v: number, _locale, config) => `${v}${String(config)}`);
  });

  it("types config as the per-language config inside the callback", () => {
    const languages: Record<"en", { ordinal: { other: string } }> = {
      en: { ordinal: { other: "th" } },
    };
    const { tool } = createTranslationConfig({
      languages,
      default: "en",
    });

    tool("place", (v: number, _locale, config) => {
      expectTypeOf(config).toEqualTypeOf<{ ordinal: { other: string } }>();

      return `${v}${config.ordinal.other}`;
    });
  });

  it("types config as the union of slices when languages differ in shape", () => {
    const languages: { en: { suffix: string }; ja: { counter: string } } = {
      en: { suffix: "th" },
      ja: { counter: "番目" },
    };
    const { tool } = createTranslationConfig({
      languages,
      default: "en",
    });

    tool("place", (v: number, _locale, config) => {
      expectTypeOf(config).toEqualTypeOf<
        { suffix: string } | { counter: string }
      >();

      return String(v);
    });
  });

  it("rejects a wrong-typed value at the call site", () => {
    const { tool } = createTranslationConfig({
      languages: { en: {} },
      default: "en",
    });
    const stamp = msg`${tool("at", (v: Date) => v.toISOString())}`;

    // @ts-expect-error - `at` must be a Date.
    stamp({ at: "2026-07-11" });
  });

  it("resolves a tool-bearing template to its parameterised function", () => {
    const { define, tool } = createTranslationConfig({
      languages: { en: {} },
      default: "en",
    });
    const t = define({
      k: { en: msg`${tool("count", (v: number) => String(v))}` },
    });

    expectTypeOf(t("en").k).toEqualTypeOf<
      (dict: { count: number }) => string
    >();
  });
});
