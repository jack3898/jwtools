import { type ToolKey, tool } from "../tool";
import { memoize } from "./cache";

/**
 * The plural categories defined by Unicode CLDR / `Intl.PluralRules`. Handy for
 * typing your own per-language category tables, such as ordinal suffixes.
 */
export type PluralRule = "zero" | "one" | "two" | "few" | "many" | "other";

type PluralVariants = Partial<Record<PluralRule, string>> & { other: string };

const pluralRules = memoize(
  (locale: string | undefined, options: Intl.PluralRulesOptions | undefined) =>
    new Intl.PluralRules(locale, options),
);

/**
 * Selects wording for a count using `Intl.PluralRules` for the active locale.
 * The value is a `number`, and `other` is the required fallback category.
 *
 * @param name The template parameter name; its value must be a `number`.
 * @param variants The wording per plural category (`other` is required).
 *
 * @example ```ts
 * msg`${plural("count", { one: "1 file", other: "many files" })}`;
 * // { count: 1 } renders "1 file"
 * ```
 */
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
