import { describe, expect, it } from "vitest";
import { createTranslationConfig, msg } from "..";
import { date } from "./date";

describe("date", () => {
  it("formats a Date for the active locale", () => {
    const { define } = createTranslationConfig({
      languages: { en: {}, de: {} },
      default: "en",
    });
    const t = define({
      when: {
        en: msg`${date("day", { dateStyle: "long", timeZone: "UTC" })}`,
        de: msg`${date("day", { dateStyle: "long", timeZone: "UTC" })}`,
      },
    });
    const day = new Date("2020-01-15T12:00:00Z");

    expect(t("en").when({ day })).toBe("January 15, 2020");
    expect(t("de").when({ day })).toBe("15. Januar 2020");
  });

  it("accepts an epoch-millisecond number too", () => {
    const { define } = createTranslationConfig({
      languages: { en: {} },
      default: "en",
    });
    const t = define({
      when: {
        en: msg`${date("day", { dateStyle: "short", timeZone: "UTC" })}`,
      },
    });

    expect(t("en").when({ day: Date.UTC(2020, 0, 15) })).toBe("1/15/20");
  });
});
