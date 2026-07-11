import { type ToolKey, tool } from "../tool";
import { memoize } from "./cache";

const listFormat = memoize(
  (locale: string | undefined, options: Intl.ListFormatOptions | undefined) =>
    new Intl.ListFormat(locale, options),
);

export function list<const Name extends string>(
  name: Name,
  options?: Intl.ListFormatOptions,
): ToolKey<Name, string[]> {
  return tool(name, (value: string[], locale) =>
    listFormat(locale, options).format(value),
  );
}
