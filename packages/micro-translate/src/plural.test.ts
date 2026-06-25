import { describe, expect, it } from "vitest";
import { createTranslationConfig, msg, plural } from ".";

describe(plural.name, () => {
  it("is selected for the active locale via the translator", () => {
    const define = createTranslationConfig({
      languages: ["en"],
      default: "en",
    });
    const t = define({
      fileCount: {
        en: msg`${plural("count", { one: "file", other: "files" })}`,
      },
    });

    expect(t("en").fileCount({ count: 1 })).toBe("file");
    expect(t("en").fileCount({ count: 0 })).toBe("files");
    expect(t("en").fileCount({ count: 5 })).toBe("files");
  });

  it("uses each locale's own plural rules", () => {
    const define = createTranslationConfig({
      languages: ["en", "ar"],
      default: "en",
    });
    const t = define({
      fileCount: {
        en: msg`${plural("count", { one: "one", other: "many" })}`,
        ar: msg`${plural("count", {
          zero: "zero",
          one: "one",
          two: "two",
          few: "few",
          many: "many",
          other: "other",
        })}`,
      },
    });

    // Arabic distinguishes six categories where English only has two.
    expect(t("ar").fileCount({ count: 0 })).toBe("zero");
    expect(t("ar").fileCount({ count: 1 })).toBe("one");
    expect(t("ar").fileCount({ count: 2 })).toBe("two");
    expect(t("ar").fileCount({ count: 3 })).toBe("few");
    expect(t("ar").fileCount({ count: 11 })).toBe("many");

    expect(t("en").fileCount({ count: 3 })).toBe("many");
  });

  it("falls back to `other` when the selected category is missing", () => {
    const define = createTranslationConfig({
      languages: ["en"],
      default: "en",
    });
    const t = define({
      // `one` is omitted, so count: 1 must fall back to `other`.
      itemCount: {
        en: msg`${plural("count", { other: "items" })}`,
      },
    });

    expect(t("en").itemCount({ count: 1 })).toBe("items");
  });

  it("combines a named parameter with a plural", () => {
    const define = createTranslationConfig({
      languages: ["en"],
      default: "en",
    });
    const t = define({
      summary: {
        en: msg`${"name"} has ${plural("count", {
          one: "1 file",
          other: "many files",
        })}`,
      },
    });

    expect(t("en").summary({ name: "Ada", count: 1 })).toBe("Ada has 1 file");
    expect(t("en").summary({ name: "Ada", count: 9 })).toBe(
      "Ada has many files",
    );
  });
});
