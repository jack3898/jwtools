const pluralBrand = Symbol("micro-translate/plural");

/**
 * The plural categories defined by Unicode CLDR / `Intl.PluralRules`. Shared by
 * cardinal plurals and ordinals (which use a subset).
 */
export type PluralRule = "zero" | "one" | "two" | "few" | "many" | "other";

/**
 * The variant strings for a plural; `other` is the required fallback.
 */
type PluralVariants = Partial<Record<PluralRule, string>> & { other: string };

export type PluralKey<Name extends string = string> = {
  [pluralBrand]: true;
  name: Name;
  variants: PluralVariants;
};

/**
 * Declares a pluralized template parameter. Inside a `msg`, the named
 * parameter is typed as a `number`, and the correct variant is selected at
 * render time using `Intl.PluralRules` for the active locale.
 *
 * @example ```ts
 * msg`${plural("count", { one: "file", other: "files" })}`;
 * ```
 *
 * @param name The parameter name; its value must be a `number`
 * @param variants The string to use per plural category (`other` is required)
 */
export function plural<const Name extends string>(
  name: Name,
  variants: PluralVariants,
): PluralKey<Name> {
  return { [pluralBrand]: true, name, variants };
}

export function isPluralKey(key: unknown): key is PluralKey {
  return typeof key === "object" && key !== null && pluralBrand in key;
}

/**
 * Memoizes one {@link Intl.PluralRules} per locale + type. Constructing these is
 * comparatively expensive, and templates resolve on every key access, so we
 * reuse a shared instance keyed by `type:locale` (empty locale for the runtime
 * default). Ordinals (`type: "ordinal"`) reuse this same cache.
 */
const pluralRulesCache = new Map<string, Intl.PluralRules>();

export function getPluralRules(
  locale?: string,
  type: Intl.PluralRulesOptions["type"] = "cardinal",
): Intl.PluralRules {
  const cacheKey = `${type}:${locale ?? ""}`;
  let rules = pluralRulesCache.get(cacheKey);

  if (!rules) {
    rules = new Intl.PluralRules(locale, { type });
    pluralRulesCache.set(cacheKey, rules);
  }

  return rules;
}
