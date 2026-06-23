type TranslationConfig<Languages> = {
  languages: Languages[];
};

/**
 * A translation for a single locale: either a literal string, or a template
 * function (e.g. from `template`) that resolves to a string when given its
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
 * Use this to type a value that should accept "the result of `define(...)`" —
 * for example a `useTranslation` hook — while preserving full inference of the
 * translation keys. Constrain a generic with it rather than annotating directly
 * so the concrete keys survive:
 *
 * @example ```tsx
 * import type { Translator } from "@jack3898/micro-translate";
 *
 * // `T` keeps the exact keys, so `t.welcome`/`t.submit` stay fully typed.
 * export function useTranslation<const T extends Translator>(translator: T) {
 *   const locale = useUserLocale(); // your locale source, e.g. "en" | "jp"
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
 * its value across the supported locales. Use it to annotate the return of a
 * wrapper such as a `useTranslation` hook so callers keep the exact key types:
 *
 * @example ```tsx
 * import type { Translation, Translator } from "@jack3898/micro-translate";
 *
 * export function useTranslation<const T extends Translator>(
 *   translator: T,
 * ): Translation<T> {
 *   const locale = useUserLocale(); // "en" | "jp"
 *   return translator(locale) as Translation<T>;
 * }
 * ```
 */
export type Translation<T extends Translator> = ReturnType<T>;

export function createTranslationConfig<Language extends string>(
  _config: TranslationConfig<Language>,
) {
  return <const T extends TranslationDict<Language>>(
    translations: T,
  ): Translator<T, Language> =>
    <Locale extends Language>(locale: Locale) =>
      new Proxy({} as { [K in keyof T]: T[K][Locale] }, {
        get: (_target, key) => {
          const value = translations[key as keyof T]?.[locale];

          // Template values are locale-aware (e.g. pluralization), so bind the
          // active locale before handing the function back to the caller.
          if (typeof value !== "function") {
            return value;
          }

          return (dict: never) => value(dict, locale);
        },
      });
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
 * Declares a pluralized template parameter. Inside a `template`, the named
 * parameter is typed as a `number`, and the correct variant is selected at
 * render time using `Intl.PluralRules` for the active locale.
 *
 * @example ```ts
 * template`${plural("count", { one: "file", other: "files" })}`;
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

type TemplateKey = string | number | typeof $ | PluralKey;

type UnionToIntersection<U> = (
  U extends unknown
    ? (arg: U) => void
    : never
) extends (arg: infer I) => void
  ? I
  : never;

type IndexedParams = { [index: number]: string };

type PluralParam<Name extends string> = { [P in Name]: number };

type NamedParam<Key extends PropertyKey> = { [P in Key]: string };

type NoParams = Record<never, never>;

type FinalTemplateDict<Keys> = [Keys] extends [never]
  ? NoParams
  : UnionToIntersection<
      Keys extends typeof $
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
): (dict: FinalTemplateDict<Keys[number]>) => string {
  const render = (
    dict: FinalTemplateDict<Keys[number]>,
    locale?: string,
  ): string => {
    const values = dict as Record<PropertyKey, string | number>;
    const result = [strings[0]];

    for (const [i, key] of keys.entries()) {
      if (key === $ && Array.isArray(dict)) {
        result.push(dict[i], strings[i + 1]);

        continue;
      }

      if (isPluralKey(key)) {
        const count = Number(values[key.name]);
        const category = new Intl.PluralRules(locale).select(count);

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
