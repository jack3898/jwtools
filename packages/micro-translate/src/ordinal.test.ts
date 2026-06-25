import { describe, expect, it } from "vitest";
import { createTranslationConfig, msg, ordinal } from ".";

describe(ordinal.name, () => {
  const define = createTranslationConfig({
    languages: ["en", "ja", "fr"],
    default: "en",
    ordinals: {
      en: { one: "st", two: "nd", few: "rd", other: "th" },
      ja: { other: "番目" },
      fr: { one: "er", other: "e" },
    },
  });

  const t = define({
    place: {
      en: msg`You came ${ordinal("place")}`,
      ja: msg`${ordinal("place")}`,
      fr: msg`Vous êtes ${ordinal("place")}`,
    },
  });

  it("renders the number with its English ordinal suffix", () => {
    expect(t("en").place({ place: 1 })).toBe("You came 1st");
    expect(t("en").place({ place: 2 })).toBe("You came 2nd");
    expect(t("en").place({ place: 3 })).toBe("You came 3rd");
    expect(t("en").place({ place: 4 })).toBe("You came 4th");
    // The irregular teens and twenties exercise the CLDR rules.
    expect(t("en").place({ place: 11 })).toBe("You came 11th");
    expect(t("en").place({ place: 21 })).toBe("You came 21st");
    expect(t("en").place({ place: 23 })).toBe("You came 23rd");
  });

  it("uses each locale's own ordinal rules and suffixes", () => {
    expect(t("ja").place({ place: 1 })).toBe("1番目");
    expect(t("fr").place({ place: 1 })).toBe("Vous êtes 1er");
    expect(t("fr").place({ place: 2 })).toBe("Vous êtes 2e");
  });

  it("falls back to `other` when the selected category is omitted", () => {
    const onlyOther = createTranslationConfig({
      languages: ["en"],
      default: "en",
      ordinals: { en: { other: "th" } },
    });
    const to = onlyOther({ place: { en: msg`${ordinal("place")}` } });

    // `one` is omitted, so 1 falls back to `other`.
    expect(to("en").place({ place: 1 })).toBe("1th");
  });

  it("throws when no ordinals are configured (runtime guard)", () => {
    const noOrdinals = createTranslationConfig({
      languages: ["en"],
      default: "en",
    });
    const to = noOrdinals({
      // @ts-expect-error - ordinal() requires `ordinals` in the config.
      place: { en: msg`${ordinal("place")}` },
    });

    expect(() => to("en").place({ place: 1 })).toThrow(
      '❌ ordinal("place") used but no "ordinals" configured for locale "en"',
    );
  });
});
