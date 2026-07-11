import type { AnyRef, Ref, TodoRef } from "./ref";

export type TranslationValue =
  | string
  | ((dict: never, locale?: string) => string)
  | AnyRef;

export type TranslationDict<Language extends string = string> = Record<
  string,
  Record<Language, TranslationValue>
>;

export type Translator<
  T extends TranslationDict = TranslationDict,
  Language extends string = string,
  Default extends string = string,
> = <Locale extends Language>(
  locale: Locale,
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

export type Translation<T extends Translator> = ReturnType<T>;
