import { describe, expect, it } from "vitest";
import { createTranslationConfig, msg, ref } from ".";
import type { PluralRule } from "./intl";

type OrdinalTable = Partial<Record<PluralRule, string>> & { other: string };

describe("tool", () => {
  it("formats a value-only recipe", () => {
    const { define, tool } = createTranslationConfig({
      languages: { en: {} },
      default: "en",
    });
    const shout = (name: string) => tool(name, (v: string) => v.toUpperCase());
    const t = define({ greet: { en: msg`${shout("word")}!` } });

    expect(t("en").greet({ word: "hi" })).toBe("HI!");
  });

  it("formats a value+locale recipe", () => {
    const { define, tool } = createTranslationConfig({
      languages: { en: {}, de: {} },
      default: "en",
    });
    const money = (name: string) =>
      tool(name, (v: number, locale) =>
        new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
        }).format(v),
      );
    const t = define({
      price: { en: msg`${money("amount")}`, de: msg`${money("amount")}` },
    });

    expect(t("en").price({ amount: 1234.5 })).toBe("$1,234.50");
  });

  it("formats a value+locale+config recipe reading per-language config", () => {
    const languages: Record<"en" | "ja" | "fr", { ordinal: OrdinalTable }> = {
      en: { ordinal: { one: "st", two: "nd", few: "rd", other: "th" } },
      ja: { ordinal: { other: "番目" } },
      fr: { ordinal: { one: "er", other: "e" } },
    };
    const { define, tool } = createTranslationConfig({
      languages,
      default: "en",
    });
    const ordinal = (name: string) =>
      tool(name, (value: number, locale, config) => {
        const category = new Intl.PluralRules(locale, {
          type: "ordinal",
        }).select(value);

        return `${value}${config.ordinal[category] ?? config.ordinal.other}`;
      });
    const t = define({
      place: {
        en: msg`You came ${ordinal("place")}`,
        ja: msg`${ordinal("place")}`,
        fr: msg`Vous êtes ${ordinal("place")}`,
      },
    });

    expect(t("en").place({ place: 1 })).toBe("You came 1st");
    expect(t("en").place({ place: 22 })).toBe("You came 22nd");
    expect(t("ja").place({ place: 1 })).toBe("1番目");
    expect(t("fr").place({ place: 1 })).toBe("Vous êtes 1er");
  });

  it("falls back to `other` when the selected category is missing", () => {
    const languages: Record<"en", { ordinal: OrdinalTable }> = {
      en: { ordinal: { other: "th" } },
    };
    const { define, tool } = createTranslationConfig({
      languages,
      default: "en",
    });
    const ordinal = (name: string) =>
      tool(name, (value: number, locale, config) => {
        const category = new Intl.PluralRules(locale, {
          type: "ordinal",
        }).select(value);

        return `${value}${config.ordinal[category] ?? config.ordinal.other}`;
      });
    const t = define({ place: { en: msg`${ordinal("place")}` } });

    expect(t("en").place({ place: 1 })).toBe("1th");
  });

  it("runs a ref'd recipe under the caller's config, not the target's", () => {
    const languages: Record<"en" | "ja", { ordinal: OrdinalTable }> = {
      en: { ordinal: { one: "st", two: "nd", few: "rd", other: "th" } },
      ja: { ordinal: { other: "番目" } },
    };
    const { define, tool } = createTranslationConfig({
      languages,
      default: "en",
    });
    const ordinal = (name: string) =>
      tool(name, (value: number, locale, config) => {
        const category = new Intl.PluralRules(locale, {
          type: "ordinal",
        }).select(value);

        return `${value}${config.ordinal[category] ?? config.ordinal.other}`;
      });
    const t = define({
      place: { en: msg`${ordinal("place")}`, ja: ref("en") },
    });

    expect(t("ja").place({ place: 1 })).toBe("1番目");
    expect(t("en").place({ place: 1 })).toBe("1st");
  });
});
