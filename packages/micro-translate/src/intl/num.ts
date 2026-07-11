import { type ToolKey, tool } from "../tool";
import { memoize } from "./cache";

const numberFormat = memoize(
  (locale: string | undefined, options: Intl.NumberFormatOptions | undefined) =>
    new Intl.NumberFormat(locale, options),
);

export function num<const Name extends string>(
  name: Name,
  options?: Intl.NumberFormatOptions,
): ToolKey<Name, number> {
  return tool(name, (value: number, locale) =>
    numberFormat(locale, options).format(value),
  );
}
