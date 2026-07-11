import { describe, expect, it } from "vitest";
import { createTranslationConfig, msg } from "..";
import { num } from "./num";

describe("num", () => {
  const { define } = createTranslationConfig({
    languages: { en: {}, de: {} },
    default: "en",
  });

  it("formats with the active locale's grouping separators", () => {
    const t = define({
      available: {
        en: msg`There are ${num("count")} available`,
        de: msg`Es sind ${num("count")} verfügbar`,
      },
    });

    expect(t("en").available({ count: 1234567 })).toBe(
      "There are 1,234,567 available",
    );
    expect(t("de").available({ count: 1234567 })).toBe(
      "Es sind 1.234.567 verfügbar",
    );
  });

  it("passes options through to Intl.NumberFormat (currency)", () => {
    const t = define({
      price: {
        en: msg`${num("amount", { style: "currency", currency: "USD" })}`,
        de: msg`${num("amount", { style: "currency", currency: "EUR" })}`,
      },
    });

    expect(t("en").price({ amount: 1234.5 })).toBe("$1,234.50");
    // Intl separates the amount and currency symbol with a non-breaking space.
    expect(t("de").price({ amount: 1234.5 })).toMatch(/^1\.234,50.€$/);
  });
});
