# Micro Translate

Type-safe translations that don't fight your toolchain.

Zero dependencies, type safe to the max, colocated translations, tree-shakeable, native Intl APIs, framework-agnostic rich text, extensible, no compile step.

## Installation

```sh
pnpm install @jack3898/micro-translate
```

## Requirements

This package uses native [`Intl`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) APIs and by default are completely optional. The core needs nothing. The presets use Intl APIs. Any runtime that supports ESM syntax and standard Intl APIs should work which is most modern JS runtimes.

## How to use it

### Simplest form

Import `createTranslationConfig`, then define a translator, then pull the translation!

```ts
import { createTranslationConfig } from "@jack3898/micro-translate";

const { define } = createTranslationConfig({
  languages: { "en-GB": {} }, // Leave language/locale config empty for now
  default: "en-GB", // A default is required. You will learn why later!
});

const translator = define({
  hello: { "en-GB": "Hello!" },
});

const en = translator("en-GB");

console.log(en.hello); // "Hello!"
```

The empty object is a language config. When you first get started, this can stay empty. The language key (in this case "en-GB") is actually arbitrary however, it is best you stick to a standardized locale tag like a BCP-47 language tag (e.g. en-GB) for maximum compatibility with the Intl API built into any JS runtime. We don't provide types for this, because standards can drift between apps.

### Templating

Plain strings are great, however, a translation library isn't near complete without templating functionality. Templates allow you to inject custom values between your translations. Here, we bring in a new utility: `msg`. `msg` allows you to define template strings with strings as template keys. Yes, that syntax is correct!

```ts
import { createTranslationConfig, msg } from "@jack3898/micro-translate";

const { define } = createTranslationConfig({
  languages: { "en-GB": {} },
  default: "en-GB",
});

const translator = define({
  hello: { "en-GB": msg`Hello ${"object"}!` },
});

const en = translator("en-GB");

console.log(en.hello({ object: "world" })); // "Hello world!"
```

## Formatting with presets

Templates get a whole lot more powerful when you introduce formatters. This supercharges the template strings and allows processing of values. This covers things like number formatting, pluralization, lists, rich text, and more. Best of all, using it is as easy as calling a simple function inside of the template string.

### Pluralization

`plural` selects the right wording for a count using runtime native `Intl.PluralRules`. This picks the right plural form, and also enforces that the value is a number when using the template.

The template automatically passes the locale into `Intl.PluralRules` for you via the use of `translator("en-GB")`. This means special cases like arabic, that have 6 plural forms, can be completely declared.

```ts
import { createTranslationConfig, msg } from "@jack3898/micro-translate";
import { plural } from "@jack3898/micro-translate/intl/plural";

const { define } = createTranslationConfig({
  languages: { "en-GB": {} },
  default: "en-GB",
});

const enGBFileCount = plural("count", {
  zero: "no files",
  one: "one file",
  other: "many files",
});

const translator = define({
  files: {
    "en-GB": msg`You have ${enGBFileCount}!`,
  },
});

const en = translator("en-GB");

console.log(en.files({ count: 1 })); // "You have one file!"
```

### Number formatting

`num` formats a number with `Intl.NumberFormat` like grouping separators, decimals, currency, percent, and so on.

```ts
import { createTranslationConfig, msg } from "@jack3898/micro-translate";
import { num } from "@jack3898/micro-translate/intl/num";

const { define } = createTranslationConfig({
  languages: { "en-GB": {}, "de-DE": {} },
  default: "en-GB",
});

const translator = define({
  available: {
    "en-GB": msg`There are ${num("count")} available`,
    "de-DE": msg`Es sind ${num("count")} verfügbar`,
  },
});

console.log(translator("en-GB").available({ count: 1234567 })); // "There are 1,234,567 available"
console.log(translator("de-DE").available({ count: 1234567 })); // "Es sind 1.234.567 verfügbar"
```

And because it is a light wrapper over `Intl.NumberFormat` it can forward any [`Intl.NumberFormatOptions`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#options) parameters for more control:

```ts
import { createTranslationConfig, msg } from "@jack3898/micro-translate";
import { num } from "@jack3898/micro-translate/intl/num";

const { define } = createTranslationConfig({
  languages: { "en-GB": {}, "de-DE": {} },
  default: "en-GB",
});

const translator = define({
  price: {
    "en-GB": msg`${num("amount", { style: "currency", currency: "GBP" })}`,
    "de-DE": msg`${num("amount", { style: "currency", currency: "EUR" })}`,
  },
});

console.log(translator("en-GB").price({ amount: 1234.5 })); // "£1,234.50"
console.log(translator("de-DE").price({ amount: 1234.5 })); // "1.234,50 €"
```

### Dates

`date` formats a `Date` (or an epoch-millisecond number) with `Intl.DateTimeFormat`. Pass any [`Intl.DateTimeFormatOptions`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options). This one enforces that the values provided to the templates must be a valid Date instance or epoch millisecond number:

```ts
import { createTranslationConfig, msg } from "@jack3898/micro-translate";
import { date } from "@jack3898/micro-translate/intl/date";

const { define } = createTranslationConfig({
  languages: { "en-GB": {}, "de-DE": {} },
  default: "en-GB",
});

const translator = define({
  published: {
    "en-GB": msg`Published ${date("on", { dateStyle: "long" })}`,
    "de-DE": msg`Veröffentlicht am ${date("on", { dateStyle: "long" })}`,
  },
});

console.log(translator("en-GB").published({ on: new Date("2020-01-15") })); // "Published 15 January 2020"
console.log(translator("de-DE").published({ on: new Date("2020-01-15") })); // "Veröffentlicht am 15. Januar 2020"
```

### Lists

`list` joins a `string[]` with the locale's grammar using `Intl.ListFormat` like commas, the right conjunction, an Oxford comma where the locale uses one. This one enforces that the values provided to the templates must be an array of strings.

```ts
import { createTranslationConfig, msg } from "@jack3898/micro-translate";
import { list } from "@jack3898/micro-translate/intl/list";

const { define } = createTranslationConfig({
  languages: { "en-GB": {} },
  default: "en-GB",
});

const translator = define({
  invited: {
    "en-GB": msg`You invited ${list("names")}`,
  },
});

console.log(translator("en-GB").invited({ names: ["Ada", "Grace", "Alan"] })); // "You invited Ada, Grace and Alan"
```

And as usual, it can forward the options. So you can pass `{ type: "disjunction" }` for "or" lists, `{ style: "short" }`, and so on.

### Relative time

`relativeTime` formats an amount and a unit ("3 days ago", "in 2 hours") with `Intl.RelativeTimeFormat`. Its parameter bundles **both** inputs into one typed value, `{ value, unit }`:

```ts
import { createTranslationConfig, msg } from "@jack3898/micro-translate";
import { relativeTime } from "@jack3898/micro-translate/intl/relative-time";

const { define } = createTranslationConfig({
  languages: { "en-GB": {} },
  default: "en-GB",
});

const translator = define({
  edited: {
    "en-GB": msg`Edited ${relativeTime("when")}`,
  },
});

console.log(translator("en-GB").edited({ when: { value: -3, unit: "day" } })); // "Edited 3 days ago"
console.log(translator("en-GB").edited({ when: { value: 2, unit: "hour" } })); // "Edited in 2 hours"
```

Pass `{ numeric: "auto" }` to get "yesterday"/"tomorrow" where the locale has them. (Bundling multiple inputs into one parameter is a pattern you can reuse in your own recipes, see below.)

## Writing your own formatters with `tool()`

This is where the possibilities are almost limitless. This library is simply the composition of JavaScript functions. This means you can create your own bespoke library of formatting utilities that fit your use cases.

All of the above utilities seen so far aren't special, they're `tool` recipes pre-made for this library, and you can write your own to do whatever you like. A **recipe is just a function that returns `tool(...)`**.

### Basic API (custom "shout" formatting)

This is one of the simplest examples. A formatter that makes values uppercase. The magic with `tool()` is that it has hidden away all of the typing complexities that you would have to manage on your own without it. This package is highly type-safe, so `tool()` was created to guide you down the right path.

```ts
import { createTranslationConfig, msg } from "@jack3898/micro-translate";

// tool is returned from your `createTranslationConfig()`
const { define, tool } = createTranslationConfig({
  languages: { "en-GB": {} },
  default: "en-GB",
});

function shout<const Name extends string>(name: Name) {
  return tool(name, (value: string) => value.toUpperCase());
}

const translator = define({
  hi: { "en-GB": msg`${shout("word")}!` },
});

console.log(translator("en-GB").hi({ word: "hey" })); // "HEY!"
```

> ⚠️ The signature of your recipe must use the generic `const Name extends string` as shown above. Otherwise your dictionary types will collapse and you will lose type safety.

Notice `value: string` parameter in the function passed into `tool()`? That's actually doing a lot of heavy lifting as it's what provides the value type for the templates. E.g., the above custom tool will reject anything but a string:

```ts
// ...continuing from the example above

translator("en-GB").hi({ word: true }); // error: must be a string (as per `value: string` in the tool signature)
```

### Detect locale in your tool

The callback receives up to three arguments, and you take only what you need where config is inferred from your global config. One of those is `locale`.

For example, this is how the `num` preset is built (though you may want to cache the `new Intl.NumberFormat` construction):

```ts
import { createTranslationConfig, msg } from "@jack3898/micro-translate";

const { define, tool } = createTranslationConfig({
  languages: { "en-GB": {}, "de-DE": {} },
  default: "en-GB",
});

function money<const Name extends string>(name: Name) {
  return tool(name, (value: number, locale) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
    }).format(value);
  });
}

const translator = define({
  total: {
    "en-GB": msg`Total: ${money("amount")}`,
    "de-DE": msg`Summe: ${money("amount")}`,
  },
});

console.log(translator("en-GB").total({ amount: 9.99 })); // "Total: US$9.99"
console.log(translator("de-DE").total({ amount: 9.99 })); // "Summe: 9,99 $"
```

### Fetch translator config in your tool

Remember `createTranslationConfig`? Well, now it's come in extra handy! Think of `createTranslationConfig` as your repository of language-specific configs. You can retrieve these to supercharge your custom formatters.

Ordinals are the great example as the suffixes (`st`/`nd`/`rd`/`th`) are a property of the language, not of any one message, so you declare them once in your config and read them from `config`.

Because `config` is entirely yours, and this library does not enforce a shape (see [Per-language config](#per-language-config)), define it and put your data in `languages`:

```ts
import { createTranslationConfig } from "@jack3898/micro-translate";
import type { PluralRule } from "@jack3898/micro-translate/intl/plural";

export const { define, tool } = createTranslationConfig({
  languages: {
    "en-GB": {
      ordinal: { one: "st", two: "nd", few: "rd", other: "th" },
      currency: "GBP",
    },
    "ja-JP": {
      ordinal: { other: "番目" },
      currency: "JPY",
    },
    "fr-FR": {
      ordinal: { one: "er", other: "e" },
      currency: "EUR",
    },
  },
  default: "en-GB",
});

export const ordinal = <const Name extends string>(name: Name) =>
  tool(name, (value: number, locale, config) => {
    const category = new Intl.PluralRules(locale, { type: "ordinal" }).select(
      value,
    );
    return `${value}${config.ordinal[category] ?? config.ordinal.other}`;
  });
```

Or even the money example from above! Now powered with the config:

```ts
function money<const Name extends string>(name: Name) {
  return tool(name, (value: number, locale, { currency }) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(value);
  });
}
```

```ts
// my-component.ts
import { msg } from "@jack3898/micro-translate";
import { define, ordinal } from "./i18n";

const translator = define({
  finished: {
    "en-GB": msg`You came ${ordinal("place")}`,
    "ja-JP": msg`${ordinal("place")}`,
    "fr-FR": msg`Vous êtes ${ordinal("place")}`,
  },
});

console.log(translator("en-GB").finished({ place: 22 })); // "You came 22nd"
console.log(translator("ja-JP").finished({ place: 1 })); // "1番目"
console.log(translator("fr-FR").finished({ place: 1 })); // "Vous êtes 1er"
```

The beauty with this system is that the type of `config` as used in the `tool()` is automatically inferred from your root `createTranslationConfig`. No need to manually type it.

This brings you closer to the browser's `Intl` API rather than hiding it behind a magic abstraction in the lib. You configured the suffixes anyway.

### Per-language config

`languages` in your `createTranslationConfig` must be `{ [language]: yourConfig }`. **The shape of each value is entirely yours** be it a string, an object, nested maps, whatever your recipes need. The library never looks inside it and it's used strictly for your own `tool()` recipes.

A few things worth knowing:

- **Keep your language keys literal.** Declaring `languages` as `Record<string, YourShape>` widens the key to `string` and silently turns off language checking (any `default`, any locale, missing keys all compile). Use literal keys: `Record<"en-GB" | "ja-JP", YourShape>` or an inline object.
- **Reach for an annotation (not `satisfies`) when a recipe indexes config by a runtime value.** The ordinal recipe indexes `config.ordinal[category]` where `category` is computed at runtime, so the config leaf needs the widened type (`OrdinalTable`). Annotating `languages` (as above) gives the recipe that type; `satisfies` would keep the narrow literal and the lookup wouldn't type-check.
- **Vended tools are bound to their config.** A `tool` recipe reads config from the `createTranslationConfig` it came from, so keep config-coupled recipes in the same `i18n.ts` as their config. (Rendering one outside its translator throws a clear error.)

### Beyond strings: rich values

A recipe doesn't just have to render a string. It can render anything representable by JavaScript.

The classic use case is markup mid-sentence, like a link inside a translated sentence, without awkwardly splitting the sentence into pieces. Because it can render anything representable by JavaScript, we can return a ReactElement and render it in a React app. The only catch is you do need to know how to make a tool that can represent the destination framework's requirements.

```tsx
import type { ReactNode } from "react";
import { createTranslationConfig, msg } from "@jack3898/micro-translate";

const { define, tool } = createTranslationConfig({
  languages: { "en-GB": {}, "ja-JP": {} },
  default: "en-GB",
});

// A recipe which accepts a React Node.
function reactElement<const Name extends string>(name: Name, text: string) {
  return tool(name, (render: (text: string) => ReactNode) => render(text));
}

const translator = define({
  accept: {
    "en-GB": msg`Read ${reactElement("terms", "the terms")} before continuing`,
    "ja-JP": msg`続行する前に${reactElement("terms", "利用規約")}をお読みください`,
  },
});

function AcceptNotice() {
  const t = translator("en-GB"); // or resolve the locale from context (see the hook below)

  // A ReactElement!
  return <p>{t.accept({ terms: (text) => <a href="/terms">{text}</a> })}</p>;
}
// en-GB: <p>Read <a href="/terms">the terms</a> before continuing</p>
// ja-JP: <p>続行する前に<a href="/terms">利用規約</a>をお読みください</p>
```

## Deliberate aliasing with `ref()`

`ref` earns its place in proportion to the character-for-character overlap between locales which is very useful for close dialects (`en-GB`/`en-US`, `de-DE`/`de-AT`), rarely for unrelated languages. Rather than copy-pasting identical values (and risking drift), forward one locale to another in the same key:

```ts
import { createTranslationConfig, msg, ref } from "@jack3898/micro-translate";

const { define } = createTranslationConfig({
  languages: { "en-GB": {}, "en-US": {}, "en-AU": {} },
  default: "en-GB",
});

const translator = define({
  // Every dialect agrees, so forward to the base.
  submit: {
    "en-GB": "Submit",
    "en-US": ref("en-GB"),
    "en-AU": ref("en-GB"),
  },
  // GB differs; US and AU share the same word, so AU forwards to US.
  carPark: {
    "en-GB": "Car park",
    "en-US": "Parking lot",
    "en-AU": ref("en-US"), // forward to a dialect, not just the default
  },
  // GB and AU share the spelling; US diverges on its own.
  colour: {
    "en-GB": "Colour",
    "en-US": "Color",
    "en-AU": ref("en-GB"),
  },
});

translator("en-AU").submit; // "Submit"      (via en-GB)
translator("en-AU").carPark; // "Parking lot" (via en-US)
translator("en-AU").colour; // "Colour"       (via en-GB)
translator("en-US").colour; // "Color"        (its own value)
```

`ref("en-GB")` adopts `en-GB`'s value completely. It also forwards along all of the type safety you know and love.

One caveat is that there's no override mechanism. If a locale diverges in any way (wording, order, formatting), write a fresh template instead. This was an intentional decision as it keeps things simple to reason about and explicit. Two rules keep it safe, enforced at compile time **and** guarded at runtime:

1. The target must be another locale in the same key. `ref("fr-FR")` where `fr-FR` isn't a sibling is an error.
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
  languages: { "en-GB": {}, "en-US": {}, "en-AU": {} },
  default: "en-GB",
});

const translator = define({
  welcome: {
    "en-GB": msg`Hey ${"name"}`,
    "en-US": ref("en-GB"), // semantics imply permanent: identical to British English
    "en-AU": todo(), // semantics imply this is temporary: not localized yet, falls back to "en-GB"
  },
});

translator("en-AU").welcome({ name: "Jack" }); // "Hey Jack" (fallback)
```

This gives you gap-free incremental localization:

1. Add a new locale to `languages`. TypeScript errors on every key missing it providing a complete worklist.
2. Stub each one with `todo()`. The app compiles and ships; users get the default-locale fallback.
3. Track the backlog with `grep -rn 'todo()' src/` which is your exact list of what's left.
4. Replace each `todo()` with a real template at your own pace. Every step compiles and ships.

## Use in a framework/library: wrapping the translator (e.g. a `useTranslation` hook in React)

Often you'll want to fetch the active locale once like from a context, a logged-in user, etc. and hand back a ready-to-use translator:

```tsx
// use-translation.ts
type Locale = "en-GB" | "ja-JP"; // your app's locales

export function useTranslation<T>(translator: (locale: Locale) => T): T {
  const locale = useUserLocale(); // your locale source

  return translator(locale);
}
```

Then a component passes its colocated translator straight in and keeps full autocomplete and type-safety on every key:

```tsx
// my-component.tsx
import { msg } from "@jack3898/micro-translate";
import { define } from "./i18n";
import { useTranslation } from "./use-translation";

const translator = define({
  submit: { "en-GB": "Submit", "ja-JP": "Submitto" },
  welcome: { "en-GB": msg`Hey ${"name"}`, "ja-JP": msg`Konnichiwa ${"name"}` },
});

function MyComponent() {
  const t = useTranslation(translator);

  return <p>{t.welcome({ name: "World" })}</p>; // fully typed
}
// en-GB: <p>Hey World</p>
// ja-JP: <p>Konnichiwa World</p>
```

They key is that you simply need to provide a mechanism to feed the locale into the translator. If you can solve that, then you're golden. One downside is that each module or block requires you to reach into context of a user to fetch their locale - but that's a small price to pay.

## Colocation - and why it's going to make your life much easier

One major philosophical change this package introduces is defining translations per component or module. Where you need language, you have the translations right there for reference. This is a deliberate departure from convention that suits most applications.

While it's encouraged to provide it in the same module _without an export_, I would say it reasonable to create a dedicated file next to your module if you want to keep it separate to your business logic. Just remember to never import one translator into multiple modules: don't be afraid to define the same translation twice or 10 times.

The counterpoint is **setup**: your `createTranslationConfig`, the `define`/`tool` it vends, and any config-coupled recipes live in one central `i18n.ts`.

> Colocate the translations; centralize the setup.

Global translations can be hard to maintain for a variety of reasons. They can give a false sense of reuse, create stale translations, end up massive, and become a chore to update.

## Tradeoffs

### Not tested for enterprise

This package is not for enterprise grade software and does not seek to replace or claim to be better than alternatives like i18next! Those are battle tested and highly powerful with huge ecosystems.

### Translations are not lazy

The design of this code favours developer experience, type safety, simplicity, package size and translation colocation by design. Each module needs all translations (e.g. all variants of the word "Submit" for a button), which means users will be loading other translations not relevant to them in addition to their selected language if this is used in a frontend. One perk is that switching languages will be instantaneous for end users.

The main remedy is tree-shaking, which comes for free, but every branch of that tree still bundles all languages relevant to it. It should be noted that translations compress well, and are usually fairly small on their own so this may not be a problem depending on your situation. You may find that lazy loading more parts of your app is a good solution. But for large codebases with tens of languages, this is potentially not suitable and you should measure whether this will work for you in the context of your requirements.

### No out-of-the-box support for translators

This package does not provide an easy way for translators to update your translations as your translations live in source code. This is either something you can work around, or a genuine problem. This codebase does not offer tooling for that today.

**However, with that said... AI is everywhere.** This translation library fits extremely well into agentic workflows as it forces developers to be explicit, fix compile errors, and complete every single translation.

If you stick to the principles of translation colocation and use the [`todo()`](#never-forget-a-translation-with-todo) utility effectively, then it becomes trivially easy for an agent to grep the codebase and generate you a standardized file for translators. Then, when you receive your human-made translations, use an agent to patch them into your codebase. Any missing translations can be easily identified and reviewed.

I have considered making a standard CLI that can programmatically generate a translation file, and it's not off the table! But it's not something I have planned for now.

All in all, this should give you 90% of what you need without all the fluff!

## Note on module type

This package is distributed with ESM syntax only.

I apologize in advance for any inconvenience this may cause.

## License

Apache-2.0
