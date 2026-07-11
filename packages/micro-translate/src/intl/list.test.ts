import { describe, expect, it } from "vitest";
import { createTranslationConfig, msg } from "..";
import { list } from "./list";

describe("list", () => {
  it("joins with the active locale's conjunction", () => {
    const { define } = createTranslationConfig({
      languages: { en: {}, de: {} },
      default: "en",
    });
    const t = define({
      items: {
        en: msg`${list("things")}`,
        de: msg`${list("things")}`,
      },
    });

    expect(t("en").items({ things: ["apples", "oranges", "bananas"] })).toBe(
      "apples, oranges, and bananas",
    );
    expect(t("de").items({ things: ["Äpfel", "Orangen", "Bananen"] })).toBe(
      "Äpfel, Orangen und Bananen",
    );
  });

  it("supports disjunction via options", () => {
    const { define } = createTranslationConfig({
      languages: { en: {} },
      default: "en",
    });
    const t = define({
      items: { en: msg`${list("things", { type: "disjunction" })}` },
    });

    expect(t("en").items({ things: ["a", "b", "c"] })).toBe("a, b, or c");
  });
});
