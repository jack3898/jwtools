# Micro Translate

Ultra type-safe translations that doesn't fight your toolchain. Works in any application and uses native APIs.

## How to use it

### Define your translations

Declare the languages you support, then provide a translation for every key in every language. A translation is either a plain string or a `msg` template:

```ts
import { createTranslationConfig, msg } from "@jack3898/micro-translate";

export const translations = createTranslationConfig({
  languages: ["en", "jp"],
});
```

Then in your module (React JSX as an example):

```tsx
import { msg } from "@jack3898/micro-translate";
import { translations } from "../../file.ts";

const translator = translations({
  submit: {
    en: "Submit",
    jp: "Submitto",
  },
  welcome: {
    en: msg`Hey ${"name"}`,
    jp: msg`Konnichiwa ${"name"}`,
  },
});

export function MyComponent() {
  // In your app you might want to make this a custom hook or embed ths translator into your logged in user code!
  const locale = useUserLocale(); // "en" | "jp"
  const t = translator(locale);

  return (
    <form>
      <p>{t.welcome({ name: "World" })}</p>
      <button type="submit">{t.submit}</button>
    </form>
  );
}
```

Every key must cover every declared language — miss one and TypeScript will tell you.

### Read a translation raw

Pick a locale, then read the key. Plain strings come back as-is; templates are functions you call with their parameters:

```ts
translator("en").submit; // "Submit"
translator("jp").submit; // "Submitto"

translator("en").welcome({ name: "World" }); // "Hey World"
translator("jp").welcome({ name: "World" }); // "Konnichiwa World"
```

The parameters a template needs are inferred from how you wrote it, so `welcome` requires `{ name: string }` and nothing else.

### Pluralization

`plural` selects the right wording for a count using what's already avaiable in your runtime: `Intl.PluralRules`. The parameter must be a **number** (a string is a type error), and `other` is the required fallback:

```ts
import {
  createTranslationConfig,
  msg,
  plural,
} from "@jack3898/micro-translate";

const define = createTranslationConfig({ languages: ["en"] });

const translator = define({
  fileCount: {
    en: msg`You have ${"files"} ${plural("count", { one: "file", other: "files" })}`,
  },
});

translator("en").fileCount({ files: "1", count: 1 });
translator("en").fileCount({ files: "5", count: 5 });
```

The active locale flows automatically from `translator("ar")` into the plural, so each language uses its own rules. When a category is omitted, it falls back to
`other`.

You can mix plain text, named parameters and plurals in one template:

```ts
msg`${"name"} has ${plural("count", { one: "1 file", other: "many files" })}`;
// call with { name: "Ada", count: 1 } -> "Ada has 1 file"
```

## Embrace colocation!

One major philosophical change this package introduces is defining translations per component or module. Where you need language, you have a define right there for reference.

This package was written with that in mind at its core.

Global translations can be hard to maintain for a variety of reasons. They can give a false sense of reuse, create stale translations, end up massive, and it becomes a complete chore to update.

While I don't recommend this package for enterprise-grade software, for small to medium sized apps, and apps where you don't mind having all translations included in a load for the users, this is perfect.

## Note on module type

This package is distributed with ESM syntax only.

I apologise in advance for any inconvenience this may cause.
