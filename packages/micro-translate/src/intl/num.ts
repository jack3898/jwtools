import { type ToolKey, tool } from "../tool";
import { memoize } from "./cache";

const numberFormat = memoize(
  (locale: string | undefined, options: Intl.NumberFormatOptions | undefined) =>
    new Intl.NumberFormat(locale, options),
);

/**
 * Formats a number for the active locale with `Intl.NumberFormat`: grouping
 * separators, decimals, currency, percent, and so on.
 *
 * @param name The template parameter name; its value must be a `number`.
 * @param options Passed to `Intl.NumberFormat` (style, currency, and so on).
 *
 * @example ```ts
 * msg`${num("price", { style: "currency", currency: "USD" })}`;
 * // { price: 1234.5 } renders "$1,234.50"
 * ```
 */
export function num<const Name extends string>(
  name: Name,
  options?: Intl.NumberFormatOptions,
): ToolKey<Name, number> {
  return tool(name, (value: number, locale) =>
    numberFormat(locale, options).format(value),
  );
}
