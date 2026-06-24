type TranslationConfig<Languages> = {
  languages: Languages[];
};

/**
 * A translation for a single locale: either a literal string, or a template
 * function (e.g. from `msg`) that resolves to a string when given its
 * interpolation values and the active locale.
 */
type TranslationValue = string | ((dict: never, locale?: string) => string);

/**
 * The dictionary passed to a `define(...)` call: a record of keys, each mapping
 * every supported language to a {@link TranslationValue}.
 */
type TranslationDict<Language extends string = string> = Record<
  string,
  Record<Language, TranslationValue>
>;

/**
 * The translator returned by a `define(...)` call. Give it the active locale
 * and it resolves every key to that locale's value.
 *
 * Use this to name "the result of `define(...)`" when typing a value that holds
 * one be it a prop, a context value, etc.
 *
 * To wrap a translator (e.g. a `useTranslation` hook), prefer pinning your
 * locale union and inferring the resolved translations, which keeps the keys
 * without a type assertion:
 *
 * @example ```tsx
 * type Locale = "en" | "jp"; // your app's locales
 *
 * // `T` is the resolved translations; the exact keys stay fully typed.
 * export function useTranslation<T>(translator: (locale: Locale) => T): T {
 *   const locale = useUserLocale(); // your locale source
 *   return translator(locale);
 * }
 * ```
 */
export type Translator<
  T extends TranslationDict = TranslationDict,
  Language extends string = string,
> = <Locale extends Language>(
  locale: Locale,
) => { [K in keyof T]: T[K][Locale] };

/**
 * The resolved translations a {@link Translator} produces — every key mapped to
 * its value across the supported locales.
 *
 * @example ```ts
 * import type { Translation } from "@jack3898/micro-translate";
 *
 * const translator = define({ submit: { en: "Submit", jp: "Submitto" } });
 *
 * type T = Translation<typeof translator>; // { submit: "Submit" | "Submitto" }
 * ```
 */
export type Translation<T extends Translator> = ReturnType<T>;

export function createTranslationConfig<Language extends string>(
  _config: TranslationConfig<Language>,
) {
  return <const T extends TranslationDict<Language>>(
    translations: T,
  ): Translator<T, Language> =>
    <Locale extends Language>(locale: Locale) => {
      // Resolves a single key for the active locale. Plain strings pass through;
      // template values are locale-aware (e.g. pluralization), so the active
      // locale is bound before the function is handed back to the caller.
      const resolve = (key: PropertyKey) => {
        const value = translations[key as keyof T]?.[locale];

        if (typeof value !== "function") {
          return value;
        }

        return (dict: never) => value(dict, locale);
      };

      return new Proxy({} as { [K in keyof T]: T[K][Locale] }, {
        get: (_target, key) => (key in translations ? resolve(key) : undefined),
        has: (_target, key) => key in translations,
        ownKeys: () => Reflect.ownKeys(translations),
        getOwnPropertyDescriptor: (_target, key) =>
          key in translations
            ? {
                configurable: true,
                enumerable: true,
                writable: false,
                value: resolve(key),
              }
            : undefined,
      });
    };
}

export const $ = Symbol("template-placeholder");

const pluralBrand = Symbol("micro-translate/plural");

/**
 * The plural categories defined by Unicode CLDR / `Intl.PluralRules`.
 */
type PluralRule = "zero" | "one" | "two" | "few" | "many" | "other";

/**
 * The variant strings for a plural; `other` is the required fallback.
 */
type PluralVariants = Partial<Record<PluralRule, string>> & { other: string };

type PluralKey<Name extends string = string> = {
  [pluralBrand]: true;
  name: Name;
  variants: PluralVariants;
};

/**
 * Declares a pluralized template parameter. Inside a `msg`, the named
 * parameter is typed as a `number`, and the correct variant is selected at
 * render time using `Intl.PluralRules` for the active locale.
 *
 * @example ```ts
 * msg`${plural("count", { one: "file", other: "files" })}`;
 * ```
 *
 * @param name The parameter name; its value must be a `number`
 * @param variants The string to use per plural category (`other` is required)
 */
export function plural<const Name extends string>(
  name: Name,
  variants: PluralVariants,
): PluralKey<Name> {
  return { [pluralBrand]: true, name, variants };
}

function isPluralKey(key: unknown): key is PluralKey {
  return typeof key === "object" && key !== null && pluralBrand in key;
}

/**
 * Memoizes one {@link Intl.PluralRules} per locale. Constructing these is
 * comparatively expensive, and templates resolve on every key access, so we
 * reuse a shared instance keyed by locale (`undefined` for the runtime default).
 */
const pluralRulesCache = new Map<string | undefined, Intl.PluralRules>();

function getPluralRules(locale?: string): Intl.PluralRules {
  let rules = pluralRulesCache.get(locale);

  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, rules);
  }

  return rules;
}

type TemplateKey = string | number | typeof $ | PluralKey;

type TemplateIndexSymbol = typeof $;

type UnionToIntersection<U> = (
  U extends unknown
    ? (arg: U) => void
    : never
) extends (arg: infer I) => void
  ? I
  : never;

type IndexedParams = string[];

type PluralParam<Name extends string> = { [P in Name]: number };

type NamedParam<Key extends PropertyKey> = { [P in Key]: string | number };

type NoParams = Record<never, never>;

type FinalTemplateDict<Keys> = [Keys] extends [never]
  ? NoParams
  : UnionToIntersection<
      Keys extends TemplateIndexSymbol
        ? IndexedParams
        : Keys extends PluralKey<infer Name>
          ? PluralParam<Name>
          : Keys extends string | number
            ? NamedParam<Keys>
            : NoParams
    >;

export function msg<const Keys extends readonly TemplateKey[]>(
  strings: TemplateStringsArray,
  ...keys: Keys
): (
  dict: {
    // Inlined `{ [K in keyof T]: T[K] }` flattens the computed dict (which is
    // built from intersections internally) into a single object literal, so it
    // hovers as the resolved shape instead of `A & B`. The mapping is homomorphic,
    // so the `$` array form is preserved as `string[]` rather than mangled.
    [K in keyof FinalTemplateDict<Keys[number]>]: FinalTemplateDict<
      Keys[number]
    >[K];
  },
) => string {
  const render = (
    dict: {
      [K in keyof FinalTemplateDict<Keys[number]>]: FinalTemplateDict<
        Keys[number]
      >[K];
    },
    locale?: string,
  ): string => {
    const values = dict as Record<PropertyKey, string | number>;
    const result = [strings[0]];

    // `$` placeholders are positional: each one consumes the next array element
    // in order of appearance, independent of where it sits among `keys`.
    let placeholderIndex = 0;

    for (const [i, key] of keys.entries()) {
      if (key === $ && Array.isArray(dict)) {
        result.push(dict[placeholderIndex], strings[i + 1]);
        placeholderIndex++;

        continue;
      }

      if (isPluralKey(key)) {
        const count = Number(values[key.name]);
        const category = getPluralRules(locale).select(count);

        result.push(
          key.variants[category] ?? key.variants.other,
          strings[i + 1],
        );

        continue;
      }

      if (typeof key === "string" || typeof key === "number") {
        result.push(String(values[key]), strings[i + 1]);
      }
    }

    return result.join("");
  };

  // The locale is injected by the translator; the return-type annotation omits
  // it from the public signature, so callers only pass the dict.
  return render;
}
