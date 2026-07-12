# Micro Translate

Type-safe translations that don't fight your toolchain.

Zero dependencies, fully type-inferred parameters, colocated translations, tree-shakeable, native Intl APIs, extensible, no compile step.

## Installation

```sh
pnpm install @jack3898/micro-translate
```

## Requirements

This package uses native [`Intl`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) APIs and by default are completely optional. The core needs nothing; the presets wrap `Intl.NumberFormat`, `Intl.PluralRules`, `Intl.DateTimeFormat`, `Intl.ListFormat` and `Intl.RelativeTimeFormat` - available in Node 16+ and all modern browsers. It is distributed as ESM only (see [Note on module type](#note-on-module-type)) and are imported on a different path that is separate to core.

## How to use it

### 1. Set up your config

Declare your languages and pick a default. Each language is a **key**; its **value** is that language's config which is data your formatters can read (see [Writing your own formatters](#writing-your-own-formatters-with-tool)). If you don't have any config yet, use an empty object.

```ts
// i18n.ts
import { createTranslationConfig } from "@jack3898/micro-translate";

export const { define, tool } = createTranslationConfig({
  languages: { en: {}, ja: {} },
  default: "en", // required, and strictly typed to the keys of `languages`
});
```

`default` is the locale [`todo()`](#never-forget-a-translation-with-todo) falls back to.

### 2. Define your translations

Then in your module, provide a value for every language in every key. This library relies on template literals for magical string interpolation.

```tsx
import { msg } from "@jack3898/micro-translate";
import { define } from "./i18n";

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

You must provide a value for every language and a missing one is a compile error. (See [`todo()`](#never-forget-a-translation-with-todo) for partial rollouts.)

### 3. Use the translator

After defining your translations, you can then fetch them. Translations that used tagged template strings must be called as a function, and requires parameters to be passed in.

```tsx
const t = translator("en");

console.log(t.submit); // "Submit"
console.log(t.welcome({ name: "Jack" })); // "Hey Jack"
console.log(t.welcome({ surname: "Surname" })); // type error, surname does not exist
```

The parameters are magically inferred fully from the `msg` template literal you defined. If you change your template, then you need to update the object you pass at each call site, and TypeScript will point you at every call that no longer matches.

## Formatting with presets

Tagged template strings get a whole lot more powerful when you introduce formatters. This supercharges the template strings and allows processing of values before they're injected into the final string. This covers things like number formatting, pluralization, lists and more. Best of all, using it is as easy as calling a simple function inside of the template string.

### Pluralization

`plural` selects the right wording for a count using runtime native `Intl.PluralRules`. This picks the right plural form, and also enforces that the value is a number when using the template.

The template automatically passes the locale into `Intl.PluralRules` for you via the use of `translator("en")`. This means special cases like arabic, that have 6 plural forms, can be completely declared.

```ts
import { msg } from "@jack3898/micro-translate";
import { plural } from "@jack3898/micro-translate/intl/plural";
import { define } from "./i18n";

const translator = define({
  fileCount: {
    en: msg`You have ${plural("count", { one: "1 file", other: "many files" })}`,
  },
});

const t = translator("en");

t.fileCount({ count: 1 }); // "You have 1 file"
t.fileCount({ count: 5 }); // "You have many files"
```

### Number formatting

`num` formats a number with `Intl.NumberFormat` like grouping separators, decimals, currency, percent, and so on. This also enforces at the type level that the `count` must be provided as a number only:

```ts
import { msg } from "@jack3898/micro-translate";
import { num } from "@jack3898/micro-translate/intl/num";
import { define } from "./i18n";

const translator = define({
  available: {
    en: msg`There are ${num("count")} available`,
    de: msg`Es sind ${num("count")} verfügbar`,
  },
});

translator("en").available({ count: 1234567 }); // "There are 1,234,567 available"
translator("de").available({ count: 1234567 }); // "Es sind 1.234.567 verfügbar"
```

And because it is a light wrapper over `Intl.NumberFormat` it can forward any [`Intl.NumberFormatOptions`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#options) parameters for more control:

```ts
const translator = define({
  price: {
    en: msg`${num("amount", { style: "currency", currency: "USD" })}`,
    de: msg`${num("amount", { style: "currency", currency: "EUR" })}`,
  },
});

translator("en").price({ amount: 1234.5 }); // "$1,234.50"
translator("de").price({ amount: 1234.5 }); // "1.234,50 €"
```

### Dates

`date` formats a `Date` (or an epoch-millisecond number) with `Intl.DateTimeFormat`. Pass any [`Intl.DateTimeFormatOptions`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options). This one enforces that the values provided to the templates must be a valid Date instance or epoch millisecond number:

```ts
import { msg } from "@jack3898/micro-translate";
import { date } from "@jack3898/micro-translate/intl/date";
import { define } from "./i18n";

const translator = define({
  published: {
    en: msg`Published ${date("on", { dateStyle: "long" })}`,
    de: msg`Veröffentlicht am ${date("on", { dateStyle: "long" })}`,
  },
});

translator("en").published({ on: new Date("2020-01-15") }); // "Published January 15, 2020"
translator("de").published({ on: new Date("2020-01-15") }); // "Veröffentlicht am 15. Januar 2020"
```

### Lists

`list` joins a `string[]` with the locale's grammar using `Intl.ListFormat` like commas, the right conjunction, an Oxford comma where the locale uses one. This one enforces that the values provided to the templates must be an array of strings.

```ts
import { list } from "@jack3898/micro-translate/intl/list";

const translator = define({
  invited: {
    en: msg`You invited ${list("names")}`,
  },
});

translator("en").invited({ names: ["Ada", "Grace", "Alan"] }); // "You invited Ada, Grace, and Alan"
```

And as usual, it can forward the options. So you can pass `{ type: "disjunction" }` for "or" lists, `{ style: "short" }`, and so on.

### Relative time

`relativeTime` formats an amount and a unit ("3 days ago", "in 2 hours") with `Intl.RelativeTimeFormat`. Its parameter bundles **both** inputs into one typed value, `{ value, unit }`:

```ts
import { relativeTime } from "@jack3898/micro-translate/intl/relative-time";

const translator = define({
  edited: {
    en: msg`Edited ${relativeTime("when")}`,
  },
});

translator("en").edited({ when: { value: -3, unit: "day" } }); // "Edited 3 days ago"
translator("en").edited({ when: { value: 2, unit: "hour" } }); // "Edited in 2 hours"
```

Pass `{ numeric: "auto" }` to get "yesterday"/"tomorrow" where the locale has them. (Bundling multiple inputs into one parameter is a pattern you can reuse in your own recipes, see below.)

## Writing your own formatters with `tool()`

This is where the possibilities are almost limitless. This library is simply the composition of JavaScript functions. This means you can create your own bespoke library of formatting utilities that fit your use cases.

All of the above utilities seen so far aren't special, they're `tool` recipes pre-made for this library, and you can write your own to do whatever you like. A **recipe is just a function that returns `tool(...)`**.

### Basic API (custom "shout" formatting)

This is one of the simplest examples. A formatter that makes values uppercase. The magic with `tool()` is that it has hidden away all of the typing complexities that you would have to manage on your own without it. This package is highly type-safe, so `tool()` was created to guide you down the right path.

```ts
import { tool } from "./i18n"; // tool is returned from your `createTranslationConfig()`

function shout<const Name extends string>(name: Name) {
  return tool(name, (value: string) => value.toUpperCase());
}

// define({ hi: { en: msg`${shout("word")}!` } })
// translator("en").hi({ word: "hey" }) -> "HEY!"
```

When you wrap `tool()` in a recipe, keep the name a literal type with `<const Name extends string>` rather than typing it as `string`. This ensures that the dictionary you pass in to the template has the correct keys. This library will reject using a custom tool without it so don't worry about forgetting this step.

Notice `value: string` parameter in the function passed into `tool()`? That's actually doing a lot of heavy lifting as it's what provides the value type for the templates. E.g., the above custom tool will reject anything but a string:

```ts
// ... your shout tool is defined in this module

const translator = define({
  shouted: {
    en: msg`Edited ${shout("word")}`,
  },
});

translator("en").shouted({ word: true }); // error: must be a string (as per `value: string` in the tool signature)
```

### Detect locale in your tool

The callback receives up to three arguments, and you take only what you need where config is inferred from your global config. One of those is `locale`.

For example, this is how the `num` preset is built (though you may want to cache the `new Intl.NumberFormat` construction):

```ts
function money<const Name extends string>(name: Name) {
  return tool(name, (value: number, locale) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD", // Your own mapping logic could go here depending on `locale`
    }).format(value);
  });
}
```

### Fetch translator config in your tool

Remember `createTranslationConfig`? Well, now it's come in extra handy! Think of `createTranslationConfig` as your repository of language-specific configs. You can retrieve these to supercharge your custom formatters.

Ordinals are the great example as the suffixes (`st`/`nd`/`rd`/`th`) are a property of the language, not of any one message, so you declare them once in your config and read them from `config`.

Because `config` is entirely yours, and this library does not enforce a shape (see [Per-language config](#per-language-config)), define it and put your data in `languages`:

```ts
// i18n.ts
import { createTranslationConfig } from "@jack3898/micro-translate";
import type { PluralRule } from "@jack3898/micro-translate/intl/plural";

type OrdinalTable = Partial<Record<PluralRule, string>> & { other: string };

const languages: Record<"en" | "ja" | "fr", { ordinal: OrdinalTable }> = {
  en: { ordinal: { one: "st", two: "nd", few: "rd", other: "th" } },
  ja: { ordinal: { other: "番目" } },
  fr: { ordinal: { one: "er", other: "e" } },
};

export const { define, tool } = createTranslationConfig({
  languages,
  default: "en",
});

export const ordinal = <const Name extends string>(name: Name) =>
  tool(name, (value: number, locale, config) => {
    const category = new Intl.PluralRules(locale, { type: "ordinal" }).select(
      value,
    );
    return `${value}${config.ordinal[category] ?? config.ordinal.other}`;
  });
```

```ts
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

The beauty with this system is that the type of `config` as used in the `tool()` is automatically inferred from your root `createTranslationConfig`. No need to manually type it.

This brings you closer to the browser's `Intl` API rather than hiding it behind a magic abstraction in the lib. You configured the suffixes anyway.

### Per-language config

The library owns only the outer keying: `languages` must be `{ [language]: yourConfig }`. **The shape of each value is entirely yours** be it a string, an object, nested maps, whatever your recipes need. The library never looks inside it and it's used strictly for your own `tool()` recipes.

A few things worth knowing:

- **Keep your language keys literal.** Declaring `languages` as `Record<string, YourShape>` widens the key to `string` and silently turns off language checking (any `default`, any locale, missing keys all compile). Use literal keys — `Record<"en" | "ja", YourShape>` or an inline object.
- **Reach for an annotation (not `satisfies`) when a recipe indexes config by a runtime value.** The ordinal recipe indexes `config.ordinal[category]` where `category` is computed at runtime, so the config leaf needs the widened type (`OrdinalTable`). Annotating `languages` (as above) gives the recipe that type; `satisfies` would keep the narrow literal and the lookup wouldn't type-check.
- **Vended tools are bound to their config.** A `tool` recipe reads config from the `createTranslationConfig` it came from, so keep config-coupled recipes in the same `i18n.ts` as their config. (Rendering one outside its translator throws a clear error.)

## Deliberate aliasing with `ref()`

`ref` earns its place in proportion to the character-for-character overlap between locales which is very useful for close dialects (`en-gb`/`en-us`, `de-de`/`de-at`), rarely for unrelated languages. Rather than copy-pasting identical values (and risking drift), forward one locale to another in the same key:

```ts
import { createTranslationConfig, msg, ref } from "@jack3898/micro-translate";

const { define } = createTranslationConfig({
  languages: { "en-gb": {}, "en-us": {}, "en-au": {} },
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
  // GB and AU share the spelling; US diverges on its own.
  colour: {
    "en-gb": "Colour",
    "en-us": "Color",
    "en-au": ref("en-gb"),
  },
});

translator("en-au").submit; // "Submit"      (via en-gb)
translator("en-au").carPark; // "Parking lot" (via en-us)
translator("en-au").colour; // "Colour"       (via en-gb)
translator("en-us").colour; // "Color"        (its own value)
```

`ref("en-gb")` adopts `en-gb`'s value completely. It also forwards along all of the type safety you know and love.

One caveat is that there's no override mechanism. If a locale diverges in any way (wording, order, formatting), write a fresh template instead. This was an intentional decision as it keeps things simple to reason about and explicit. Two rules keep it safe, enforced at compile time **and** guarded at runtime:

1. The target must be another locale in the same key. `ref("fr")` where `fr` isn't a sibling is an error.
2. The target must be a real value, never another `ref()`/`todo()`. This one-hop rule makes chains, cycles and self-reference structurally impossible.

## Never forget a translation with `todo()`

One of this library's top rules is that EVERYTHING must be translated and that any missing keys are a compile error. So, how does one introduce a new language incrementally?

The answer is `todo()`. This is actually a thin wrapper over `ref()`, but differs in its semantics as it uses your **default language** as specified in your `createTranslationConfig`:

```ts
import {
  createTranslationConfig,
  msg,
  ref,
  todo,
} from "@jack3898/micro-translate";

const { define } = createTranslationConfig({
  languages: { "en-gb": {}, "en-us": {}, "en-au": {} },
  default: "en-gb",
});

const translator = define({
  welcome: {
    "en-gb": msg`Hey ${"name"}`,
    "en-us": ref("en-gb"), // semantics imply permanent: identical to British English
    "en-au": todo(), // semantics imply this is temporary: not localized yet, falls back to "en-gb"
  },
});

translator("en-au").welcome({ name: "Jack" }); // "Hey Jack" (fallback)
```

This gives you gap-free incremental localization:

1. Add a new locale to `languages`. TypeScript errors on every key missing it providing a complete worklist.
2. Stub each one with `todo()`. The app compiles and ships; users get the default-locale fallback.
3. Track the backlog with `grep -rn 'todo()' src/` which is your exact list of what's left.
4. Replace each `todo()` with a real template at your own pace. Every step compiles and ships.

## Use in a framework/library: wrapping the translator (e.g. a `useTranslation` hook in React)

Often you'll want to fetch the active locale once like from a context, a logged-in user, etc. and hand back a ready-to-use translator:

```tsx
type Locale = "en" | "ja"; // your app's locales

export function useTranslation<T>(translator: (locale: Locale) => T): T {
  const locale = useUserLocale(); // your locale source

  return translator(locale);
}
```

Then a component passes its colocated translator straight in and keeps full autocomplete and type-safety on every key:

```tsx
const translator = define({
  submit: { en: "Submit", ja: "Submitto" },
  welcome: { en: msg`Hey ${"name"}`, ja: msg`Konnichiwa ${"name"}` },
});

function MyComponent() {
  const t = useTranslation(translator);

  return <p>{t.welcome({ name: "World" })}</p>; // fully typed
}
```

They key is that you simply need to provide a mechanism to feed the locale into the translator. If you can solve that, then you're golden. One downside is that each module or block requires you to reach into context of a user to fetch their locale - but that's a small price to pay.

## Colocation - and why it's going to make your life much easier

One major philosophical change this package introduces is defining translations per component or module. Where you need language, you have the translations right there for reference. This is a deliberate departure from convention that suits most applications.

While it's encouraged to provide it in the same module _without an export_, I would say it reasonable to create a dedicated file next to your module if you want to keep it separate to your business logic. Just remember to never import one translator into multiple modules: don't be afraid to define the same translation twice or 10 times.

The counterpoint is **setup**: your `createTranslationConfig`, the `define`/`tool` it vends, and any config-coupled recipes live in one central `i18n.ts`.

> Colocate the translations; centralize the setup.

Global translations can be hard to maintain for a variety of reasons. They can give a false sense of reuse, create stale translations, end up massive, and become a chore to update.

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
