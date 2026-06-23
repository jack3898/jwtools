# Micro Translate

Ultra type-safe translations that doesn't fight your toolchain. Works in any application and uses native APIs.

## How to use it

### Define your translations

Declare the languages you support, then provide a translation for every key in every language.

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
  // See further down in this readme for a more concrete React example.
  const t = translator("en");

  return (
    <form>
      <p>{t.welcome({ name: "World" })}</p>
      <button type="submit">{t.submit}</button>
    </form>
  );
}
```

A translation is either a plain string or a `msg` template:

Every key must cover every declared language — miss one and TypeScript will tell you. Support for partial localization may come in the future!

### Pluralization

`plural` selects the right wording for a count using what's already available in your runtime: `Intl.PluralRules`. The parameter must be a **number** (a string is a type error), and `other` is the required fallback:

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

### Wrapping the translator (e.g. a `useTranslation` hook in React)

Often you'll want to fetch the active locale once be it from context, a logged-in user, etc. and hand back a ready-to-use translator. The `Translator` and `Translation` type helpers let you write that wrapper without losing any of the
inferred keys.

`Translator` is "the result of `define(...)`", and `Translation<T>` is what that translator resolves to. Constrain a generic with `Translator` so the concrete keys flow through, and annotate the return with `Translation<T>`:

```tsx
import { type Translation, type Translator } from "@jack3898/micro-translate";

export function useTranslation<const T extends Translator>(
  translator: T,
): Translation<T> {
  const locale = useUserLocale(); // your locale source, e.g. "en" | "jp"

  return translator(locale) as Translation<T>;
}
```

Then a component passes its colocated translator straight in and keeps full autocomplete and type-safety on every key:

```tsx
const translator = define({
  submit: { en: "Submit", jp: "Submitto" },
  welcome: { en: msg`Hey ${"name"}`, jp: msg`Konnichiwa ${"name"}` },
});

function MyComponent() {
  const t = useTranslation(translator);

  return <p>{t.welcome({ name: "World" })}</p>; // fully typed
}
```

## Embrace colocation!

One major philosophical change this package introduces is defining translations per component or module. Where you need language, you have the translations right there for reference. This is a major departure from the norm and I think this is fine for most applications.

Global translations can be hard to maintain for a variety of reasons. They can give a false sense of reuse, create stale translations, end up massive, and it becomes a complete chore to update.

While I don't recommend this package for enterprise-grade software, for small to medium sized apps, and apps where you don't mind having all translations included in a load for the users, this is perfect.

## Note on module type

This package is distributed with ESM syntax only.

I apologise in advance for any inconvenience this may cause.
