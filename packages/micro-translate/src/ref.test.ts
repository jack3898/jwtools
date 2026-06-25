import { describe, expect, it } from "vitest";
import { createTranslationConfig, msg, plural, ref, todo } from ".";

describe(ref.name, () => {
  const define = createTranslationConfig({
    languages: ["en", "en-gb", "fr"],
    default: "en",
  });

  it("forwards a plain string to the target locale's value", () => {
    const t = define({
      carPark: {
        en: "Parking lot",
        "en-gb": "Car park",
        fr: ref("en"),
      },
    });

    // `fr` is a literal paste of `en`.
    expect(t("fr").carPark).toBe("Parking lot");
    // A dialect target is fine too.
    expect(t("en-gb").carPark).toBe("Car park");
  });

  it("forwards a template, passing arguments through verbatim", () => {
    const t = define({
      welcome: {
        en: msg`Hey ${"name"}`,
        "en-gb": ref("en"),
        fr: ref("en"),
      },
    });

    expect(t("fr").welcome({ name: "Jack" })).toBe("Hey Jack");
    expect(t("en-gb").welcome({ name: "Ada" })).toBe("Hey Ada");
  });

  it("runs pluralization under the caller's locale, not the target's", () => {
    const t = define({
      fileCount: {
        en: msg`${plural("count", {
          zero: "z",
          one: "o",
          two: "t",
          few: "f",
          many: "m",
          other: "x",
        })}`,
        "en-gb": ref("en"),
        // Arabic-style coverage is irrelevant here; `fr` pastes `en`'s template.
        fr: ref("en"),
      },
    });

    // `en` only distinguishes `one`; everything else is `other`.
    expect(t("en").fileCount({ count: 2 })).toBe("x");
    // The same forwarded template selects `en-gb`/`en` rules under those callers.
    expect(t("en-gb").fileCount({ count: 1 })).toBe("o");
  });

  it("throws when the target does not exist (Rule 1)", () => {
    const t = define({
      // @ts-expect-error - Rule 1: "de" is not a sibling locale.
      greeting: { en: "Hi", "en-gb": ref("de"), fr: ref("en") },
    });

    expect(() => t("en-gb").greeting).toThrow(
      '❌ ref("de") target does not exist',
    );
  });

  it("throws when the target is itself a ref() (Rule 2)", () => {
    const t = define({
      submit: {
        en: "Submit",
        "en-gb": ref("en"),
        // @ts-expect-error - Rule 2: "en-gb" is itself a ref().
        fr: ref("en-gb"),
      },
    });

    expect(() => t("fr").submit).toThrow(
      '❌ ref("en-gb") points at another ref() — point at a real value',
    );
  });
});

describe(todo.name, () => {
  const define = createTranslationConfig({
    languages: ["en", "en-gb", "fr"],
    default: "en",
  });

  it("falls back to the default locale's value", () => {
    const t = define({
      welcome: {
        en: msg`Hey ${"name"}`,
        "en-gb": ref("en"),
        fr: todo(),
      },
    });

    expect(t("fr").welcome({ name: "Jack" })).toBe("Hey Jack");
  });

  it("throws when used on the default locale (Rule 3)", () => {
    const t = define({
      // @ts-expect-error - Rule 3: todo() on the default locale points at itself.
      greeting: { en: todo(), "en-gb": ref("en"), fr: todo() },
    });

    expect(() => t("en").greeting).toThrow(
      '❌ todo() used on the default locale "en" — there\'s nothing to fall back to',
    );
  });
});
