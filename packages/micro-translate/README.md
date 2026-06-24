# Micro Translate

Ultra type-safe translations that don't fight your toolchain. Works in any application and uses native APIs.

## How to use it

### Define your translations

Declare the languages you support, then provide a translation for every key in every language.

```ts
import { createTranslationConfig, msg } from "@jack3898/micro-translate";

export const define = createTranslationConfig({
  languages: ["en", "jp"],
});
```

Then in your module define your translations:

```tsx
import { msg } from "@jack3898/micro-translate";
import { translations } from "../../your-i18n";

const translator = define({
  submit: {
    en: "Submit",
    jp: "Submitto",
  },
  welcome: {
    en: msg`Hey ${"name"}`,
    jp: msg`Konnichiwa ${"name"}`,
  },
});
```

Every key must cover every declared language - miss one and TypeScript will tell you. Support for partial localization may come in the future! But for now that may be a limitation for you.

Then in the code itself:

```tsx
const t = translator("en");

console.log(t.submit); // "Submit"
console.log(t.welcome({ name: "Jack" })); // "Hey Jack"
```

### Pluralization

`plural` selects the right wording for a count using what's already available in your runtime: `Intl.PluralRules`. The parameter must be a **number** (a string is a type error), and `other` is the required fallback:

```ts
import {
  createTranslationConfig,
  msg,
  plural,
} from "@jack3898/micro-translate";

const define = createTranslationConfig({
  languages: ["en"],
});

const pluralFiles = plural("count", {
  one: "1 file",
  other: "many files",
});

const translator = define({
  fileCount: {
    en: msg`You have ${pluralFiles}`,
  },
});

translator("en").fileCount({ count: 1 }); // "You have 1 file"
translator("en").fileCount({ count: 5 }); // "You have many files"
```

The active locale flows automatically from `translator("en")` into the plural, so each language uses its own rules. Arabic, for instance, has six plural categories where English has two. When a category is omitted, it falls back to
`other`.

You can mix plain text, named parameters and plurals in one template:

```ts
const pluralFiles = plural("count", { one: "1 file", other: "many files" });

msg`${"name"} has ${pluralFiles}`;
// call with { name: "Ada", count: 1 } -> "Ada has 1 file"
```

### Placeholder approach

Not sure what to name your translation keys? Or only have one and want a little less boilerplate? Use the handy `$` helper.

```ts
import { $, msg } from "@jack3898/micro-translate";

msg`Hey ${$}`;
// call with an array ["Jack"] -> "Hey Jack"
```

### Index approach

Placeholders have a fixed order. But you can use numbers too as your keys.

```ts
import { msg } from "@jack3898/micro-translate";

msg`Hey ${0}, ${1}`;
// call with an array ["Jack", "what's up?"] -> "Hey Jack, what's up?"
```

### Wrapping the translator (e.g. a `useTranslation` hook in React)

Often you'll want to fetch the active locale once be it from context, a logged-in user, etc. and hand back a ready-to-use translator. Pin your app's locale union and let the wrapper infer the resolved translations. The keys flow through untouched, no type assertion needed:

```tsx
type Locale = "en" | "jp"; // your app's locales

export function useTranslation<T>(translator: (locale: Locale) => T): T {
  const locale = useUserLocale(); // your locale source e.g. user query

  return translator(locale);
}
```

Then a component passes its colocated translator straight in and keeps full autocomplete and type-safety on every key:

```tsx
import { define } from "../../i18n";

const translator = define({
  submit: { en: "Submit", jp: "Submitto" },
  welcome: { en: msg`Hey ${"name"}`, jp: msg`Konnichiwa ${"name"}` },
});

function MyComponent() {
  const t = useTranslation(translator);

  return <p>{t.welcome({ name: "World" })}</p>; // fully typed
}
```

If you mix keys across languages, then the type system will merge all available keys for you to make sure that no matter the language, the template is satisfied.

Two type helpers are exported if you need to name these types elsewhere (a prop, a context value, etc.): `Translator` is "the result of `define(...)`", and `Translation<T>` is what such a translator resolves to.

## Embrace colocation!

One major philosophical change this package introduces is defining translations per component or module. Where you need language, you have the translations right there for reference. This is a major departure from the norm and I think this is fine for most applications.

Global translations can be hard to maintain for a variety of reasons. They can give a false sense of reuse, create stale translations, end up massive, and it becomes a complete chore to update.

## Tradeoffs

This package is not for enterprise grade software and does not seek to replace or claim to be better than alternatives like i18next! Those are battle tested and highly powerful with huge ecosystems.

The design of this code favours developer experience, type safety, simplicity, package size and translation colocation by design. Each module needs all translations, which means users will be loading other translations not relevant to them in addition to their selected language if this is used in a frontend. One perk is that switching languages will be instantaneous for end users.

The main remedy to this is this package is tree-shakeable by design, and as such that comes for free. But for every branch in that tree, is a bundle of languages translated relevant to that branch. It should be noted that translations compress well, and are usually fairly small on their own so this may not be a problem depending on your situation. You may find that lazy loading more parts of your app is a good solution.

In addition, this package does not provide an easy way for translators to update your translations as your translations live in source code. This is either something you can work around, or a genuine problem. This codebase does not offer any solutions in that regard.

All in all, this should give you 90% of what you need without all the fluff!

## Note on module type

This package is distributed with ESM syntax only.

I apologise in advance for any inconvenience this may cause.
