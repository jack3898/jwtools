const numBrand = Symbol("micro-translate/num");

export type NumKey<Name extends string = string> = {
  [numBrand]: true;
  name: Name;
  options?: Intl.NumberFormatOptions;
};

/**
 * Declares a number template parameter formatted with {@link Intl.NumberFormat}
 * for the active locale — grouping separators, decimals, currency, percent, etc.
 * The parameter is typed as a `number`. Needs no config: the locale alone drives
 * the formatting.
 *
 * @example ```ts
 * msg`There are ${num("count")} available`; // en 1234 -> "There are 1,234 available"
 * msg`${num("price", { style: "currency", currency: "USD" })}`; // 1234.5 -> "$1,234.50"
 * ```
 *
 * @param name The parameter name; its value must be a `number`
 * @param options Passed straight to `Intl.NumberFormat` (style, currency, …)
 */
export function num<const Name extends string>(
  name: Name,
  options?: Intl.NumberFormatOptions,
): NumKey<Name> {
  return { [numBrand]: true, name, ...(options ? { options } : {}) };
}

export function isNumKey(key: unknown): key is NumKey {
  return typeof key === "object" && key !== null && numBrand in key;
}

/**
 * Memoizes one {@link Intl.NumberFormat} per locale + options. Constructing
 * these is comparatively expensive and templates resolve on every key access,
 * so we reuse a shared instance keyed by `locale` and the serialized options.
 */
const numberFormatCache = new Map<string, Intl.NumberFormat>();

export function getNumberFormat(
  locale?: string,
  options?: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const cacheKey = `${locale ?? ""}:${options ? JSON.stringify(options) : ""}`;
  let format = numberFormatCache.get(cacheKey);

  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(cacheKey, format);
  }

  return format;
}
