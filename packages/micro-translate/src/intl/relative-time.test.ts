import { describe, expect, it } from "vitest";
import { createTranslationConfig, msg } from "..";
import { relativeTime } from "./relative-time";

describe("relativeTime", () => {
  it("formats a value and unit for the active locale", () => {
    const { define } = createTranslationConfig({
      languages: { en: {}, es: {} },
      default: "en",
    });
    const t = define({
      when: {
        en: msg`${relativeTime("ago")}`,
        es: msg`${relativeTime("ago")}`,
      },
    });

    expect(t("en").when({ ago: { value: -3, unit: "day" } })).toBe(
      "3 days ago",
    );
    expect(t("en").when({ ago: { value: 2, unit: "hour" } })).toBe(
      "in 2 hours",
    );
    expect(t("es").when({ ago: { value: -3, unit: "day" } })).toBe(
      "hace 3 días",
    );
  });

  it("supports `numeric: auto` via options", () => {
    const { define } = createTranslationConfig({
      languages: { en: {} },
      default: "en",
    });
    const t = define({
      when: { en: msg`${relativeTime("ago", { numeric: "auto" })}` },
    });

    expect(t("en").when({ ago: { value: -1, unit: "day" } })).toBe("yesterday");
  });
});
