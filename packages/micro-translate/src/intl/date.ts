import { type ToolKey, tool } from "../tool";
import { memoize } from "./cache";

const dateTimeFormat = memoize(
  (
    locale: string | undefined,
    options: Intl.DateTimeFormatOptions | undefined,
  ) => new Intl.DateTimeFormat(locale, options),
);

export function date<const Name extends string>(
  name: Name,
  options?: Intl.DateTimeFormatOptions,
): ToolKey<Name, Date | number> {
  return tool(name, (value: Date | number, locale) =>
    dateTimeFormat(locale, options).format(value),
  );
}
