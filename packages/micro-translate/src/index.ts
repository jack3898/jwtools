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

type TranslationConfig<
  Language extends string,
  Default extends Language,
  Config,
> = {
  languages: Language[];
  default: Default;
  configs?: Config;
};

type VendedTool<
  Language extends string,
  Config extends Record<Language, unknown>,
> = <const Name extends string, V>(
  name: Name,
  format: (value: V, locale: Language, config: Config[Language]) => string,
) => ToolKey<Name, V>;

export function createTranslationConfig<
  const Language extends string,
  const Default extends Language,
  const Config extends Record<Language, unknown> = Record<Language, unknown>,
>(config: TranslationConfig<Language, Default, Config>) {
  const languages = new Set<string>(config.languages);

  function isConfiguredLanguage(language: string): language is Language {
    return languages.has(language);
  }

  const define =
    <const T extends TranslationDict<Language>>(
      translations: T & ValidateDict<T, Default>,
    ): Translator<T, Language, Default> =>
    <Locale extends Language>(locale: Locale) => {
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
          const cfg = config.configs?.[locale];

          return (dict: never) => template(dict, locale, cfg);
        }

        throw new Error(
          "❌ unsupported method of translation. Use a ref, todo, string literal or msg template",
        );
      };

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

  return { define, tool: bareTool as unknown as VendedTool<Language, Config> };
}

export { type Msg, msg } from "./msg";
export { type Ref, ref, type TodoRef, todo } from "./ref";
export type { ToolKey } from "./tool";
export type { Translation, Translator } from "./types";
