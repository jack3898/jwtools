import { isMsg } from "./msg";
import { isRef } from "./ref";
import { tool as bareTool, type ToolKey } from "./tool";
import type {
  ResolveValue,
  TranslationDict,
  TranslationValue,
  Translator,
  ValidateDict,
} from "./types";

type LooseRecordKeys<Languages> = keyof Languages & string;

type TranslationConfig<
  Languages extends Record<string, unknown>,
  Default extends keyof Languages & string,
> = {
  languages: Languages;
  default: Default;
};

/**
 * Creates a translator factory bound to your languages and their per-language
 * config. Keep this in a central `i18n.ts` and import `define`/`tool` from there.
 *
 * Each key of `languages` is a supported language; its value is that language's
 * config: arbitrary data your {@link tool} recipes can read (use `{}` when a
 * language needs none). `default` must be one of those languages and is the
 * locale {@link todo} falls back to.
 *
 * @returns `{ define, tool }`, both bound to this config.
 *
 * @example ```ts
 * // i18n.ts
 * export const { define, tool } = createTranslationConfig({
 *   languages: { en: {}, ja: {} },
 *   default: "en",
 * });
 * ```
 */
export function createTranslationConfig<
  const LanguageConfigRecord extends Record<string, unknown>,
  const DefaultLanguageString extends keyof LanguageConfigRecord & string,
>(config: TranslationConfig<LanguageConfigRecord, DefaultLanguageString>) {
  const languages = new Set<string>(Object.keys(config.languages));

  function isConfiguredLanguage(
    language: string,
  ): language is LooseRecordKeys<LanguageConfigRecord> {
    return languages.has(language);
  }

  const configOf = <Locale extends keyof LanguageConfigRecord>(
    locale: Locale,
  ): LanguageConfigRecord[Locale] => config.languages[locale];

  /**
   * Builds a custom formatter (a "recipe"). It's the primitive every formatter is
   * made of: {@link num}, {@link plural}, {@link date} and friends are all `tool`
   * recipes.
   *
   * The type you annotate on the callback's `value` becomes the call-site
   * parameter type for `name`. The callback also receives the active `locale` and
   * this config's per-language `config` slice; take only what you need.
   *
   * @param name The template parameter name this formatter reads.
   * @param format Turns the value (plus locale and config) into a rendered
   * value: usually a string, but anything else (a React element, say) makes the
   * containing template resolve to an array of chunks.
   *
   * @example ```ts
   * // beside your config, in i18n.ts
   * const shout = <const Name extends string>(name: Name) =>
   *   tool(name, (value: string) => value.toUpperCase());
   * // msg`${shout("word")}` -> requires { word: string }
   * ```
   */
  const tool = <const Name extends string, V, Out>(
    name: Name,
    format: (
      value: V,
      locale: LooseRecordKeys<LanguageConfigRecord>,
      config: LanguageConfigRecord[LooseRecordKeys<LanguageConfigRecord>],
    ) => Out,
  ): ToolKey<Name, V, Out> =>
    bareTool(name, (value: V, locale): Out => {
      if (locale === undefined || !isConfiguredLanguage(locale)) {
        throw new Error(
          `❌ tool("${name}") must be rendered by a translator from the same createTranslationConfig`,
        );
      }

      return format(value, locale, configOf(locale));
    });

  /**
   * Declares a set of translations and returns a `translator`.
   *
   * Pass a dictionary of keys, each mapping every configured language to a
   * string, a {@link msg} template, or a {@link ref}/{@link todo} marker. Call the
   * returned translator with a locale to get an object of resolved values.
   *
   * @example ```ts
   * const translator = define({
   *   submit: { en: "Submit", ja: "Submitto" },
   *   welcome: { en: msg`Hey ${"name"}`, ja: msg`Konnichiwa ${"name"}` },
   * });
   *
   * translator("en").submit; // "Submit"
   * translator("en").welcome({ name: "Jack" }); // "Hey Jack"
   * ```
   */
  const define =
    <const T extends TranslationDict<LooseRecordKeys<LanguageConfigRecord>>>(
      translations: T & ValidateDict<T, DefaultLanguageString>,
    ): Translator<
      T,
      LooseRecordKeys<LanguageConfigRecord>,
      DefaultLanguageString
    > =>
    <Locale extends LooseRecordKeys<LanguageConfigRecord>>(locale: Locale) => {
      const resolve = (key: PropertyKey) => {
        const entry:
          | Record<LooseRecordKeys<LanguageConfigRecord>, TranslationValue>
          | undefined = translations[key as keyof T];
        let translationDefinition = entry?.[locale];

        if (isRef(translationDefinition)) {
          const targetLocale = translationDefinition(config.default);
          const target = isConfiguredLanguage(targetLocale)
            ? entry?.[targetLocale]
            : undefined;

          if (target === undefined) {
            throw new Error(`❌ ref("${targetLocale}") target does not exist`);
          }

          if (isRef(target)) {
            throw new Error(
              translationDefinition.wasTodo
                ? `❌ todo() used on the default locale "${targetLocale}" — there's nothing to fall back to`
                : `❌ ref("${targetLocale}") points at another ref() — point at a real value`,
            );
          }

          translationDefinition = target;
        }

        if (typeof translationDefinition === "string") {
          return translationDefinition;
        }

        if (isMsg(translationDefinition)) {
          const template = translationDefinition;

          return (dict: never) => template(dict, locale);
        }

        throw new Error(
          "❌ unsupported method of translation. Use a ref, todo, string literal or msg template",
        );
      };

      const result = {} as {
        [K in keyof T]: ResolveValue<T[K], T[K][Locale], DefaultLanguageString>;
      };

      for (const key of Object.keys(translations)) {
        Object.defineProperty(result, key, {
          configurable: true,
          enumerable: true,
          get() {
            const value = resolve(key);

            Object.defineProperty(result, key, {
              value,
              writable: false,
              enumerable: true,
              configurable: true,
            });

            return value;
          },
        });
      }

      return result;
    };

  return { define, tool };
}

export { type Msg, msg } from "./msg";
export { type Ref, ref, type TodoRef, todo } from "./ref";
export type { ToolKey } from "./tool";
export type { Translation, Translator } from "./types";
