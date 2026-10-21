import type { AnyRef, Ref, TodoRef } from "./ref";

export type TranslationValue =
  | string
  | ((dict: never, locale?: string, context?: unknown) => unknown)
  | AnyRef;

export type TranslationDict<Language extends string = string> = Record<
  string,
  Record<Language, TranslationValue>
>;

/**
 * The trailing parameter a translator takes for its runtime context:
 *
 * - `never` (the bare {@link Translator} default) is a `never[]` rest: callable
 *   with a locale alone, and a supertype of every translator whatever context
 *   it takes (an optional `never` would widen to `undefined` and lose that);
 * - `unknown` (a config that declared no context) is no parameter at all;
 * - a context that admits `undefined` is optional;
 * - anything else is required, so forgetting the context is a compile error.
 */
export type ContextArgs<Context> = [Context] extends [never]
  ? never[]
  : unknown extends Context
    ? []
    : undefined extends Context
      ? [context?: Context]
      : [context: Context];

/**
 * The function returned by `define(...)`. Give it the active locale, plus the
 * runtime context its config declared (if any), and it resolves every key to
 * that locale's value.
 *
 * Use it to type a value that holds a translator: a prop, a context value, or a
 * `useTranslation` wrapper. Pin your locale union (and the context your wrapper
 * supplies) and infer the resolved translations to keep the keys without a type
 * assertion. `Context` defaults to `never`, which makes the bare `Translator` a
 * supertype of every translator whatever context it takes.
 *
 * @example ```ts
 * type Locale = "en" | "ja";
 *
 * function useTranslation<T>(translator: (locale: Locale) => T): T {
 *   return translator(getUserLocale()); // your locale source
 * }
 * ```
 */
export type Translator<
  T extends TranslationDict = TranslationDict,
  Language extends string = string,
  Default extends string = string,
  Context = never,
> = <Locale extends Language>(
  locale: Locale,
  ...context: ContextArgs<Context>
) => { [K in keyof T]: ResolveValue<T[K], T[K][Locale], Default> };

export type ResolveValue<Entry, V, Default extends string> = V extends TodoRef
  ? Default extends keyof Entry
    ? Entry[Default]
    : never
  : V extends Ref<infer Target>
    ? Target extends keyof Entry
      ? Entry[Target]
      : never
    : V;

export type ValidateDict<T extends TranslationDict, Default extends string> = {
  [K in keyof T]: {
    [L in keyof T[K]]: ValidateValue<T[K], T[K][L], Default>;
  };
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
 * The resolved translations a {@link Translator} produces: every key mapped to
 * its value across the supported locales.
 *
 * @example ```ts
 * const translator = define({ submit: { en: "Submit", ja: "Submitto" } });
 *
 * type T = Translation<typeof translator>; // { submit: "Submit" | "Submitto" }
 * ```
 */
export type Translation<T extends Translator> = ReturnType<T>;
