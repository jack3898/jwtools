import { isMsg } from "./msg";
import { isRef } from "./ref";
import { tool as bareTool, type ToolKey } from "./tool";
import type {
  ContextArgs,
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
 * The callback a {@link tool} recipe is built from. A config that declared a
 * context hands it to the recipe as a fourth argument; one that didn't keeps
 * the three-argument form, so there is nothing to ignore and nothing to read
 * by mistake.
 */
type Recipe<
  V,
  Out,
  Language extends string,
  Config,
  Context,
> = unknown extends Context
  ? (value: V, locale: Language, config: Config) => Out
  : (value: V, locale: Language, config: Config, context: Context) => Out;

/**
 * What {@link createTranslationConfig} vends: `define` and `tool`, bound to one
 * config's languages, default and (when declared) runtime context.
 */
type TranslationApi<
  LanguageConfigRecord extends Record<string, unknown>,
  DefaultLanguageString extends keyof LanguageConfigRecord & string,
  Context,
> = ReturnType<
  typeof createApi<LanguageConfigRecord, DefaultLanguageString, Context>
>;

/**
 * Creates a translator factory bound to your languages and their per-language
 * config. Keep this in a central `i18n.ts` and import `define`/`tool` from there.
 *
 * Each key of `languages` is a supported language; its value is that language's
 * config: arbitrary data your {@link tool} recipes can read (use `{}` when a
 * language needs none). `default` must be one of those languages and is the
 * locale {@link todo} falls back to.
 *
 * Some values a recipe needs are known only at render time (the viewer's
 * currency, say). Declare their shape as a runtime context with the
 * `createTranslationConfig<Context>()({ ... })` form: every recipe then
 * receives it as a fourth argument and every translator requires it alongside
 * the locale.
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
>(
  config: TranslationConfig<LanguageConfigRecord, DefaultLanguageString>,
): TranslationApi<LanguageConfigRecord, DefaultLanguageString, unknown>;
/**
 * Declares a runtime context for the config that follows: values a recipe
 * needs that are known only at render time, such as the viewer's currency.
 *
 * The context is spelled out first and the config is inferred second because
 * TypeScript cannot infer `languages` once a type argument is written out.
 * Every {@link tool} recipe from this config receives the context as its
 * fourth argument, and every translator from its `define` takes it after the
 * locale: `translator(locale, context)`. Include `undefined` in the context
 * type to make it optional.
 *
 * @example ```ts
 * // i18n.ts
 * export const { define, tool } = createTranslationConfig<{ currency: string }>()({
 *   languages: { en: {}, ja: {} },
 *   default: "en",
 * });
 *
 * export const money = <const Name extends string>(name: Name) =>
 *   tool(name, (value: number, locale, _config, { currency }) =>
 *     new Intl.NumberFormat(locale, { style: "currency", currency }).format(value),
 *   );
 *
 * // elsewhere
 * translator("en", { currency: "GBP" }).total({ amount: 9.99 });
 * ```
 */
export function createTranslationConfig<Context>(): <
  const LanguageConfigRecord extends Record<string, unknown>,
  const DefaultLanguageString extends keyof LanguageConfigRecord & string,
>(
  config: TranslationConfig<LanguageConfigRecord, DefaultLanguageString>,
) => TranslationApi<LanguageConfigRecord, DefaultLanguageString, Context>;
export function createTranslationConfig<Context>(
  config?: TranslationConfig<Record<string, unknown>, string>,
) {
  if (config !== undefined) {
    return createApi<Record<string, unknown>, string, unknown>(config);
  }

  return <
    const LanguageConfigRecord extends Record<string, unknown>,
    const DefaultLanguageString extends keyof LanguageConfigRecord & string,
  >(
    config: TranslationConfig<LanguageConfigRecord, DefaultLanguageString>,
  ) => createApi<LanguageConfigRecord, DefaultLanguageString, Context>(config);
}

function createApi<
  const LanguageConfigRecord extends Record<string, unknown>,
  const DefaultLanguageString extends keyof LanguageConfigRecord & string,
  Context,
>(config: TranslationConfig<LanguageConfigRecord, DefaultLanguageString>) {
  type Language = LooseRecordKeys<LanguageConfigRecord>;
  type LanguageConfig = LanguageConfigRecord[Language];

  const languages = new Set<string>(Object.keys(config.languages));

  function isConfiguredLanguage(language: string): language is Language {
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
   * parameter type for `name`. The callback also receives the active `locale`,
   * this config's per-language `config` slice and, when the config declared one,
   * the runtime `context` the translator was called with; take only what you
   * need.
   *
   * @param name The template parameter name this formatter reads.
   * @param format Turns the value (plus locale, config and context) into a
   * rendered value: usually a string, but anything else (a React element, say)
   * makes the containing template resolve to an array of chunks.
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
    format: Recipe<V, Out, Language, LanguageConfig, Context>,
  ): ToolKey<Name, V, Out> =>
    bareTool(name, (value: V, locale, context): Out => {
      if (locale === undefined || !isConfiguredLanguage(locale)) {
        throw new Error(
          `❌ tool("${name}") must be rendered by a translator from the same createTranslationConfig`,
        );
      }

      // `Recipe` only trims the parameter list the recipe author sees. Either
      // form accepts the full argument list at runtime.
      const run = format as (
        value: V,
        locale: Language,
        config: LanguageConfig,
        context: Context,
      ) => Out;

      return run(value, locale, configOf(locale), context as Context);
    });

  /**
   * Declares a set of translations and returns a `translator`.
   *
   * Pass a dictionary of keys, each mapping every configured language to a
   * string, a {@link msg} template, or a {@link ref}/{@link todo} marker. Call the
   * returned translator with a locale (and the runtime context, if this config
   * declared one) to get an object of resolved values.
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
    <const T extends TranslationDict<Language>>(
      translations: T & ValidateDict<T, DefaultLanguageString>,
    ): Translator<T, Language, DefaultLanguageString, Context> =>
    <Locale extends Language>(
      locale: Locale,
      ...[context]: ContextArgs<Context>
    ) => {
      const resolve = (key: PropertyKey) => {
        const entry: Record<Language, TranslationValue> | undefined =
          translations[key as keyof T];
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

          return (dict: never) => template(dict, locale, context);
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
