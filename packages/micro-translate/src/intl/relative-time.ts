import { type ToolKey, tool } from "../tool";
import { memoize } from "./cache";

/**
 * The value a {@link relativeTime} parameter takes: an amount and a time unit,
 * for example `{ value: -3, unit: "day" }`.
 */
export type RelativeTime = {
  value: number;
  unit: Intl.RelativeTimeFormatUnit;
};

const relativeTimeFormat = memoize(
  (
    locale: string | undefined,
    options: Intl.RelativeTimeFormatOptions | undefined,
  ) => new Intl.RelativeTimeFormat(locale, options),
);

/**
 * Formats a relative time such as "3 days ago" or "in 2 hours" with
 * `Intl.RelativeTimeFormat`. The value bundles both inputs as `{ value, unit }`.
 *
 * @param name The template parameter name; its value is a {@link RelativeTime}.
 * @param options Passed to `Intl.RelativeTimeFormat`, e.g. `{ numeric: "auto" }`.
 *
 * @example ```ts
 * msg`Edited ${relativeTime("when")}`;
 * // { when: { value: -3, unit: "day" } } renders "Edited 3 days ago"
 * ```
 */
export function relativeTime<const Name extends string>(
  name: Name,
  options?: Intl.RelativeTimeFormatOptions,
): ToolKey<Name, RelativeTime> {
  return tool(name, (input: RelativeTime, locale) =>
    relativeTimeFormat(locale, options).format(input.value, input.unit),
  );
}
