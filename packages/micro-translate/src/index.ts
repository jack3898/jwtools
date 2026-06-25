import { isMsg } from "./msg";
import type { OrdinalVariants } from "./ordinal";
import { isRef } from "./ref";
import type {
  ResolveValue,
  TranslationDict,
  TranslationValue,
  Translator,
  ValidateDict,
} from "./types";

type TranslationConfig<
  Language extends string,
  Default extends Language,
  Ordinals,
> = {
  languages: Language[];
  /**
   * The locale {@link todo} falls back to. Must be a member of `languages`
   * (anything else is a compile error).
   */
  default: Default;
  /**
   * Per-locale ordinal suffixes used by {@link ordinal}. Optional, but if any
   * template uses `ordinal()` it becomes required (a compile error otherwise),
   * and it must cover every language.
   */
  ordinals?: Ordinals;
};

// Whether the config declared `ordinals`. Drives the compile-time gate on
// `ordinal()`. `Ordinals` defaults to `undefined` when omitted.
type HasOrdinals<Ordinals> = [Ordinals] extends [undefined] ? false : true;

export function createTranslationConfig<
  const Language extends string,
  const Default extends Language,
  const Ordinals extends
    | Record<Language, OrdinalVariants>
    | undefined = undefined,
>(config: TranslationConfig<Language, Default, Ordinals>) {
  const languages = new Set<string>(config.languages);

  function isConfiguredLanguage(language: string): language is Language {
    return languages.has(language);
  }

  return <const T extends TranslationDict<Language>>(
    translations: T & ValidateDict<T, Default, HasOrdinals<Ordinals>>,
  ): Translator<T, Language, Default> =>
    <Locale extends Language>(locale: Locale) => {
      const resolve = (key: PropertyKey) => {
        const entry: Record<Language, TranslationValue> | undefined =
          translations[key as keyof T];
        /**
         * A template, string, todo(), or ref()
         */
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
          const ordinals = config.ordinals?.[locale];

          return (dict: never) => template(dict, locale, ordinals);
        }

        throw new Error(
          "❌ unsupported method of translation. Use a ref, todo, string literal or msg template",
        );
      };

      // hide away unsafe assertion in this lib, programmatic populations of objects are tricky
      const result = {} as {
        [K in keyof T]: ResolveValue<T[K], T[K][Locale], Default>;
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
}

export { type Msg, msg } from "./msg";
export { num } from "./num";
export { type OrdinalVariants, ordinal } from "./ordinal";
export { plural } from "./plural";
export { type Ref, ref, type TodoRef, todo } from "./ref";
export type { Translation, Translator } from "./types";
