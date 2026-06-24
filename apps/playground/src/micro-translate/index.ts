import {
  createTranslationConfig,
  msg,
  plural,
} from "@jack3898/micro-translate";

const defineTranslations = createTranslationConfig({
  languages: ["en", "ar"],
});

const translator = defineTranslations({
  greeting: {
    en: msg`Hey ${"name"} ${"surname"}`,
    ar: msg`مرحبا ${"name"} ${"surname"}`,
  },
  // English needs two forms; Arabic needs six. Each locale declares its own.
  fileCount: {
    en: msg`${"msg"} ${plural("count", {
      one: "file",
      other: "files",
    })}`,
    ar: msg`${plural("count", {
      zero: "لا ملفات",
      one: "ملف واحد",
      two: "ملفان",
      few: "ملفات",
      many: "ملفًا",
      other: "ملف",
    })}`,
  },
});

console.log(translator("en").greeting({ name: "World", surname: "ok" })); // "Hey World"
console.log(translator("en").fileCount({ count: 1, msg: "" }));

// The plural param requires a number; `Intl.PluralRules` picks the variant
// per the active locale, so the same counts resolve differently per language.
for (const count of [0, 1, 2, 3, 11]) {
  console.log(
    `en ${count} ->`,
    translator("en").fileCount({ count, msg: "ok" }),
  );
  console.log(`ar ${count} ->`, translator("ar").fileCount({ count }));
}

// utility approach

export function useTranslation<T>(translator: (locale: "en" | "ar") => T): T {
  const locale = "ar"; // your locale source

  return translator(locale);
}

const t = useTranslation(translator);

void t.fileCount;
