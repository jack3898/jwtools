import { type ToolKey, tool } from "../tool";
import { memoize } from "./cache";

export type PluralRule = "zero" | "one" | "two" | "few" | "many" | "other";

type PluralVariants = Partial<Record<PluralRule, string>> & { other: string };

const pluralRules = memoize(
  (locale: string | undefined, options: Intl.PluralRulesOptions | undefined) =>
    new Intl.PluralRules(locale, options),
);

export function plural<const Name extends string>(
  name: Name,
  variants: PluralVariants,
): ToolKey<Name, number> {
  return tool(
    name,
    (value: number, locale) =>
      variants[pluralRules(locale).select(value)] ?? variants.other,
  );
}
