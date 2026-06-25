import type { AnyRef, Ref, TodoRef } from "./ref";

/**
 * A translation for a single locale: a literal string, a template function
 * (e.g. from `msg`) that resolves to a string when given its interpolation
 * values and the active locale, or a {@link Ref}/{@link TodoRef} forwarding
 * to a sibling locale.
 */
export type TranslationValue =
  | string
  | ((dict: never, locale?: string) => string)
  | AnyRef;

/**
 * The dictionary passed to a `define(...)` call: a record of keys, each mapping
 * every supported language to a {@link TranslationValue}.
 */
export type TranslationDict<Language extends string = string> = Record<
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
  Default extends string = string,
> = <Locale extends Language>(
  locale: Locale,
) => { [K in keyof T]: ResolveValue<T[K], T[K][Locale], Default> };

/**
 * Resolves a single locale's value to its public shape. A {@link Ref}
 * forwards to its sibling target's resolved type; a {@link TodoRef} forwards to
 * the `Default` locale's. Everything else passes through. Rule 2 guarantees the
 * target is never itself a marker, so resolution terminates in a single hop —
 * no recursion, no depth limits.
 */
export type ResolveValue<Entry, V, Default extends string> = V extends TodoRef
  ? Default extends keyof Entry
    ? Entry[Default]
    : never
  : V extends Ref<infer Target>
    ? Target extends keyof Entry
      ? Entry[Target]
      : never
    : V;

/**
 * Validates a `define(...)` argument at the type level. Each locale value is
 * checked against the `ref`/`todo` rules and, when it breaks one, replaced with
 * a descriptive error-message string. Intersecting this with the original dict
 * (see {@link createTranslationConfig}) makes the offending entry unassignable,
 * surfacing the message as a compile error.
 */
export type ValidateDict<T extends TranslationDict, Default extends string> = {
  [K in keyof T]: { [L in keyof T[K]]: ValidateValue<T[K], T[K][L], Default> };
};

type ValidateValue<Entry, V, Default extends string> = V extends TodoRef
  ? Default extends keyof Entry
    ? Entry[Default] extends AnyRef
      ? `❌ todo() used on the default locale "${Default & string}" — there's nothing to fall back to`
      : V
    : V
  : V extends Ref<infer Target>
    ? Target extends keyof Entry
      ? Entry[Target] extends AnyRef
        ? `❌ ref("${Target & string}") points at another ref() — point at a real value`
        : V
      : `❌ ref("${Target & string}") target does not exist`
    : V;

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
