import { describe, expect, it } from "vitest";
import { $, createTranslationConfig, msg, plural } from ".";

describe(msg.name, () => {
  it("interpolates a single named parameter", () => {
    const greet = msg`Hey ${"name"}`;

    expect(greet({ name: "World" })).toBe("Hey World");
  });

  it("interpolates multiple named parameters", () => {
    const greet = msg`${"greeting"}, ${"name"}!`;

    expect(greet({ greeting: "Hi", name: "Ada" })).toBe("Hi, Ada!");
  });

  it("interpolates positional placeholders from an array", () => {
    const sentence = msg`${$} and ${$}`;

    expect(sentence(["apples", "oranges"])).toBe("apples and oranges");
  });

  it("interpolates a numeric index", () => {
    const message = msg`You have ${0} new messages`;

    expect(message(["5"])).toBe("You have 5 new messages");
  });

  it("returns a template with no interpolation untouched", () => {
    const plain = msg`Just text`;

    expect(plain({})).toBe("Just text");
  });
});

describe(plural.name, () => {
  it("is selected for the active locale via the translator", () => {
    const define = createTranslationConfig({ languages: ["en"] });
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
    const define = createTranslationConfig({ languages: ["en", "ar"] });
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
    const define = createTranslationConfig({ languages: ["en"] });
    const t = define({
      // `one` is omitted, so count: 1 must fall back to `other`.
      itemCount: {
        en: msg`${plural("count", { other: "items" })}`,
      },
    });

    expect(t("en").itemCount({ count: 1 })).toBe("items");
  });

  it("combines a named parameter with a plural", () => {
    const define = createTranslationConfig({ languages: ["en"] });
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

describe(createTranslationConfig.name, () => {
  const define = createTranslationConfig({ languages: ["en", "jp"] });
  const t = define({
    submit: {
      en: "Submit",
      jp: "Submitto",
    },
    welcome: {
      en: msg`Hey ${"name"}`,
      jp: msg`Konnichiwa ${"name"}`,
    },
  });

  it("resolves a plain string for the requested locale", () => {
    expect(t("en").submit).toBe("Submit");
    expect(t("jp").submit).toBe("Submitto");
  });

  it("resolves a template for the requested locale", () => {
    expect(t("en").welcome({ name: "World" })).toBe("Hey World");
    expect(t("jp").welcome({ name: "World" })).toBe("Konnichiwa World");
  });

  it("returns a fresh accessor per locale", () => {
    expect(t("en").submit).not.toBe(t("jp").submit);
  });

  it("returns undefined for an unknown key", () => {
    expect((t("en") as Record<string, unknown>).missing).toBeUndefined();
  });
});
