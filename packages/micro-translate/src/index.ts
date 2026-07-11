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

type LanguageOf<Languages> = keyof Languages & string;

type TranslationConfig<
  Languages extends Record<string, unknown>,
  Default extends keyof Languages & string,
> = {
  languages: Languages;
  default: Default;
};

type VendedTool<Languages extends Record<string, unknown>> = <
  const Name extends string,
  V,
>(
  name: Name,
  format: (
    value: V,
    locale: LanguageOf<Languages>,
    config: Languages[LanguageOf<Languages>],
  ) => string,
) => ToolKey<Name, V>;

export function createTranslationConfig<
  const Languages extends Record<string, unknown>,
  const Default extends keyof Languages & string,
>(config: TranslationConfig<Languages, Default>) {
  const languages = new Set<string>(Object.keys(config.languages));

  function isConfiguredLanguage(
    language: string,
  ): language is LanguageOf<Languages> {
    return languages.has(language);
  }

  const define =
    <const T extends TranslationDict<LanguageOf<Languages>>>(
      translations: T & ValidateDict<T, Default>,
    ): Translator<T, LanguageOf<Languages>, Default> =>
    <Locale extends LanguageOf<Languages>>(locale: Locale) => {
      const resolve = (key: PropertyKey) => {
        const entry:
          | Record<LanguageOf<Languages>, TranslationValue>
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
          const cfg = config.languages[locale];

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

  return { define, tool: bareTool as unknown as VendedTool<Languages> };
}

export { type Msg, msg } from "./msg";
export { type Ref, ref, type TodoRef, todo } from "./ref";
export type { ToolKey } from "./tool";
export type { Translation, Translator } from "./types";
