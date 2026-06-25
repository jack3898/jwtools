# Micro Translate

Type-safe translations that don't fight your toolchain.

Zero dependencies, fully type-inferred parameters, colocated translations, tree-shakeable, native Intl APIs.

## Installation

```sh
npm install @jack3898/micro-translate
```

## Requirements

This package uses native [`Intl.PluralRules`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules), available in Node 13+ and all modern browsers. It is distributed as ESM only (see [Note on module type](#note-on-module-type)).

## API at a glance

| Export                    | Purpose                                                           |
| ------------------------- | ----------------------------------------------------------------- |
| `createTranslationConfig` | Declares your supported languages, the default locale, and ordinals. |
| `msg`                     | A template literal for translations with named parameters.        |
| `plural`                  | Selects wording for a count using `Intl.PluralRules`.             |
| `ordinal`                 | Renders a number with its locale's ordinal suffix (`1` → `1st`).  |
| `ref`                     | Aliases one locale to another for character-for-character copies. |
| `todo`                    | Stubs an untranslated entry, falling back to the default locale.  |

That's it!

## How to use it

### Define your translations

Declare the languages you support, then provide a translation for every key in every language.

```ts
// i18n.ts
import { createTranslationConfig } from "@jack3898/micro-translate";

export const define = createTranslationConfig({
  languages: ["en", "ja"],
  default: "en", // required and strictly typed to the above `languages` array
});
```

`default` is used for incremental rollouts of new languages with [`todo()`](#incremental-rollout-with-todo)!

Then in your module define your translations:

```tsx
import { msg } from "@jack3898/micro-translate";
import { define } from "../../i18n";

const translator = define({
  submit: {
    en: "Submit",
    ja: "Submitto",
  },
  welcome: {
    en: msg`Hey ${"name"}`,
    ja: msg`Konnichiwa ${"name"}`,
  },
});
```

You must provide a value for every language. Again, please see below on this library's approach to partial rollouts with [`todo()`](#incremental-rollout-with-todo)!

Then in the code itself:

```tsx
const t = translator("en");

console.log(t.submit); // "Submit"
console.log(t.welcome({ name: "Jack" })); // "Hey Jack"
console.log(t.welcome({ surname: "Surname" })); // ❌ "'surname' does not exist on type" and "'name' is missing in type" type errors
```

The parameters to the template are typed fully and inferred from the `msg` template literal you defined above.

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
  default: "en",
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

const t = translator("en");

t.fileCount({ count: 1 }); // "You have 1 file"
t.fileCount({ count: 5 }); // "You have many files"
```

The active locale flows automatically from `translator("en")` into the plural, so each language uses its own rules. Arabic, for instance, has six plural categories where English has two. When a category is omitted, it falls back to `other`.

You can mix plain text, named parameters and plurals in one template:

```ts
const pluralFiles = plural("count", { one: "1 file", other: "many files" });

msg`${"name"} has ${pluralFiles}`;
// call with { name: "Ada", count: 1 } -> "Ada has 1 file"
```

### Ordinals

`ordinal` renders a number with its locale's ordinal suffix — `1` → `"1st"`, `22` → `"22nd"`. Like `plural` it selects the category with `Intl.PluralRules` (in `ordinal` mode, sharing the same cache). _Unlike_ `plural`, the suffixes are a property of the **language**, not the message — `st/nd/rd/th` is the same for every ordinal in English — so you declare them once per locale in the config rather than at each call site:

```ts
import { createTranslationConfig, msg, ordinal } from "@jack3898/micro-translate";

const define = createTranslationConfig({
  languages: ["en", "ja", "fr"],
  default: "en",
  ordinals: {
    en: { one: "st", two: "nd", few: "rd", other: "th" },
    ja: { other: "番目" },
    fr: { one: "er", other: "e" },
  },
});

const translator = define({
  finished: {
    en: msg`You came ${ordinal("place")}`,
    ja: msg`${ordinal("place")}`,
    fr: msg`Vous êtes ${ordinal("place")}`,
  },
});

translator("en").finished({ place: 22 }); // "You came 22nd"
translator("ja").finished({ place: 1 }); // "1番目"
translator("fr").finished({ place: 1 }); // "Vous êtes 1er"
```

The number is prepended for you, and the category respects each locale's CLDR rules (so English `21` is `"21st"` but `11` is `"11th"`). A missing category falls back to `other`.

`ordinals` is optional — but the moment any template uses `ordinal()`, TypeScript **requires** it (and requires it to cover every language). You can't ship an `ordinal()` whose suffixes you forgot to declare:

```ts
const define = createTranslationConfig({ languages: ["en"], default: "en" }); // no `ordinals`

define({
  place: { en: msg`${ordinal("place")}` },
  //           ^ ❌ ordinal() requires "ordinals" to be configured in createTranslationConfig
});
```

### Deliberate aliasing with `ref()`

English is a great example: `en-us`, `en-gb` and `en-au` agree on most words but diverge on a handful. Rather than copy-pasting the identical ones (and risking them drifting apart), forward one locale to another in the same key with `ref()`:

```ts
// ...imports

const define = createTranslationConfig({
  languages: ["en-gb", "en-us", "en-au"],
  default: "en-gb",
});

const translator = define({
  // Every dialect agrees, so forward to the base.
  submit: {
    "en-gb": "Submit",
    "en-us": ref("en-gb"),
    "en-au": ref("en-gb"),
  },
  // GB differs; US and AU share the same word, so AU forwards to US.
  carPark: {
    "en-gb": "Car park",
    "en-us": "Parking lot",
    "en-au": ref("en-us"), // forward to a dialect, not just the default
  },
  // GB and AU share the spelling here; US diverges on its own.
  colour: {
    "en-gb": "Colour",
    "en-us": "Color",
    "en-au": ref("en-gb"),
  },
});

translator("en-au").submit; // "Submit"   (via en-gb)
translator("en-au").carPark; // "Parking lot" (via en-us)
translator("en-au").colour; // "Colour"   (via en-gb)
translator("en-us").colour; // "Color"    (its own value)
```

`ref(target)` resolves to **exactly** the target's value for that key like a literal copy/paste. A plain string forwards the string; a `msg`/`plural` template forwards the same callable with the same call signature, and pluralization runs under the **caller's** active locale, just as a paste would.

It's only for character-for-character identical translations - there's no override mechanism. If a locale diverges in any way (wording, order, plural rules), write a fresh template for it instead. This keeps your translations explicit and simple!

Two rules keep it safe, enforced at compile time **and** guarded at runtime:

1. The target must be another locale in the same key. `ref("fr")` where `fr` isn't a sibling is an error.
2. The target must be a real value, never another `ref()`/`todo()`. This one-hop rule makes chains, cycles and self-reference structurally impossible.

### Incremental rollout with `todo()`

`todo()` stubs an entry you haven't translated yet. It's a thin wrapper over `ref()` that forwards to your configured `default` - same brand, same behavior - so it resolves to the default locale's value and every `ref()` rule applies to it automatically. It's a plain top-level import; the `default` is supplied for you when the entry resolves:

```ts
// ...imports

const define = createTranslationConfig({
  languages: ["en-gb", "en-us", "en-au"],
  default: "en-gb",
});

const translator = define({
  welcome: {
    "en-gb": msg`Hey ${"name"}`,
    "en-us": ref("en-gb"), // permanent: identical to British English
    "en-au": todo(), // stub: not localized yet, falls back to "en-gb"
  },
});

translator("en-au").welcome({ name: "Jack" }); // "Hey Jack" (fallback)
```

This gives you gap-free incremental localization:

1. Add a new locale to `languages`. TypeScript errors on every key missing it - a complete worklist.
2. Stub each one with `todo()`. The app compiles and ships, users get the default-locale fallback.
3. Track the backlog with `grep -rn 'todo()' src/` - your exact list of what's left.
4. Replace each `todo()` with a real template at your own pace. Every step compiles and ships.

This keeps your translations explicit at every stage.

### Wrapping the translator (e.g. a `useTranslation` hook in React)

Often you'll want to fetch the active locale once — from a context, a logged-in user, etc. — and hand back a ready-to-use translator. Here's an example in React which just wraps over a passed in translator and picks the right language:

```tsx
// ...imports

type Locale = "en" | "ja"; // your app's locales

export function useTranslation<T>(translator: (locale: Locale) => T): T {
  const locale = useUserLocale(); // your locale source e.g. user query

  return translator(locale);
}
```

Then a component passes its colocated translator straight in and keeps full autocomplete and type-safety on every key:

```tsx
// ...imports

const translator = define({
  submit: { en: "Submit", ja: "Submitto" },
  welcome: { en: msg`Hey ${"name"}`, ja: msg`Konnichiwa ${"name"}` },
});

function MyComponent() {
  const t = useTranslation(translator);

  return <p>{t.welcome({ name: "World" })}</p>; // fully typed
}
```

## Embrace colocation!

One major philosophical change this package introduces is defining translations per component or module. Where you need language, you have the translations right there for reference. This is a deliberate departure from convention that suits most applications.

Global translations can be hard to maintain for a variety of reasons. They can give a false sense of reuse, create stale translations, end up massive, and it becomes a complete chore to update.

## Tradeoffs

This package is not for enterprise grade software and does not seek to replace or claim to be better than alternatives like i18next! Those are battle tested and highly powerful with huge ecosystems.

The design of this code favours developer experience, type safety, simplicity, package size and translation colocation by design. Each module needs all translations, which means users will be loading other translations not relevant to them in addition to their selected language if this is used in a frontend. One perk is that switching languages will be instantaneous for end users.

The main remedy is tree-shaking, which comes for free, but every branch of that tree still bundles all languages relevant to it. It should be noted that translations compress well, and are usually fairly small on their own so this may not be a problem depending on your situation. You may find that lazy loading more parts of your app is a good solution. But for large codebases with tens of languages, this is potentially not suitable and you should measure whether this will work for you in the context of your requirements.

In addition, this package does not provide an easy way for translators to update your translations as your translations live in source code. This is either something you can work around, or a genuine problem. This codebase does not offer any solutions in that regard.

All in all, this should give you 90% of what you need without all the fluff!

## Note on module type

This package is distributed with ESM syntax only.

I apologise in advance for any inconvenience this may cause.

## License

Apache-2.0
