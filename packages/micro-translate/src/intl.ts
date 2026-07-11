import { type ToolKey, tool } from "./tool";

export type PluralRule = "zero" | "one" | "two" | "few" | "many" | "other";

type PluralVariants = Partial<Record<PluralRule, string>> & { other: string };

const numberFormatCache = new Map<string, Intl.NumberFormat>();

function getNumberFormat(
  locale: string | undefined,
  options: Intl.NumberFormatOptions | undefined,
): Intl.NumberFormat {
  const cacheKey = `${locale ?? ""}:${options ? JSON.stringify(options) : ""}`;
  let format = numberFormatCache.get(cacheKey);

  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(cacheKey, format);
  }

  return format;
}

const pluralRulesCache = new Map<string, Intl.PluralRules>();

function getPluralRules(locale: string | undefined): Intl.PluralRules {
  const cacheKey = locale ?? "";
  let rules = pluralRulesCache.get(cacheKey);

  if (!rules) {
    rules = new Intl.PluralRules(locale);
    pluralRulesCache.set(cacheKey, rules);
  }

  return rules;
}

export function num<const Name extends string>(
  name: Name,
  options?: Intl.NumberFormatOptions,
): ToolKey<Name, number> {
  return tool(name, (value: number, locale) =>
    getNumberFormat(locale, options).format(value),
  );
}

export function plural<const Name extends string>(
  name: Name,
  variants: PluralVariants,
): ToolKey<Name, number> {
  return tool(
    name,
    (value: number, locale) =>
      variants[getPluralRules(locale).select(value)] ?? variants.other,
  );
}
