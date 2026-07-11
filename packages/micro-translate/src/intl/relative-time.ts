import { type ToolKey, tool } from "../tool";
import { memoize } from "./cache";

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

export function relativeTime<const Name extends string>(
  name: Name,
  options?: Intl.RelativeTimeFormatOptions,
): ToolKey<Name, RelativeTime> {
  return tool(name, (input: RelativeTime, locale) =>
    relativeTimeFormat(locale, options).format(input.value, input.unit),
  );
}
