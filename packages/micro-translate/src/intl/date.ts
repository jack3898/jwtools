import { type ToolKey, tool } from "../tool";
import { memoize } from "./cache";

const dateTimeFormat = memoize(
  (
    locale: string | undefined,
    options: Intl.DateTimeFormatOptions | undefined,
  ) => new Intl.DateTimeFormat(locale, options),
);

/**
 * Formats a `Date` (or an epoch-millisecond number) for the active locale with
 * `Intl.DateTimeFormat`. It delegates straight to `Intl`, so an invalid `Date`
 * throws just as it does in the browser.
 *
 * @param name The template parameter name; its value must be a `Date` or `number`.
 * @param options Passed to `Intl.DateTimeFormat` (dateStyle, timeZone, and so on).
 *
 * @example ```ts
 * msg`Published ${date("on", { dateStyle: "long" })}`;
 * // { on: new Date("2020-01-15") } renders "Published January 15, 2020"
 * ```
 */
export function date<const Name extends string>(
  name: Name,
  options?: Intl.DateTimeFormatOptions,
): ToolKey<Name, Date | number> {
  return tool(name, (value: Date | number, locale) =>
    dateTimeFormat(locale, options).format(value),
  );
}
