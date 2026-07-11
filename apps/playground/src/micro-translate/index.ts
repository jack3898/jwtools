import {
  createTranslationConfig,
  msg,
  ref,
  todo,
} from "@jack3898/micro-translate";
import { num } from "@jack3898/micro-translate/intl/num";
import { plural } from "@jack3898/micro-translate/intl/plural";

const { define: defineTranslations } = createTranslationConfig({
  languages: {
    en: {
      ordinals: [],
    },
    ar: {
      ordinals: [],
    },
    gg: {
      ordinals: [],
    },
  },
  default: "en",
});

const translator = defineTranslations({
  greeting: {
    en: msg`Hey ${"name"} ${"surname"}`,
    ar: msg`مرحبا ${"name"} ${"surname"}`,
    gg: "",
  },
  // English needs two forms; Arabic needs six. Each locale declares its own.
  fileCount: {
    en: msg`${"msg"} ${plural("count", {
      one: "file",
      other: "files",
    })}`,
    gg: "",
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

// `ref()` forwards a locale to another's identical value; `todo()` stubs an
// untranslated entry, falling back to the configured default ("en").
const aliased = defineTranslations({
  submit: {
    en: "Submit",
    ar: ref("en"), // intentional: identical to English
    gg: ref("en"),
  },
  welcome: {
    en: msg`Hey ${"name"} your age is ${num("age")}`,
    gg: msg`Ok`,
    ar: todo(), // not translated yet -> falls back to "en"
  },
});

console.log(aliased("ar").submit); // "Submit"
console.log(aliased("ar").welcome({ name: "world", age: 50000 })); // "Hey World" (fallback)

// utility approach

export function useTranslation<T>(translator: (locale: "en" | "ar") => T): T {
  const locale = "ar"; // your locale source

  return translator(locale);
}

const t = useTranslation(translator);

void t.fileCount;
