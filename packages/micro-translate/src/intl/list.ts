import { type ToolKey, tool } from "../tool";
import { memoize } from "./cache";

const listFormat = memoize(
  (locale: string | undefined, options: Intl.ListFormatOptions | undefined) =>
    new Intl.ListFormat(locale, options),
);

/**
 * Joins a `string[]` with the active locale's grammar using `Intl.ListFormat`,
 * including an Oxford comma where the locale uses one.
 *
 * @param name The template parameter name; its value must be a `string[]`.
 * @param options Passed to `Intl.ListFormat` (`type`, `style`).
 *
 * @example ```ts
 * msg`You invited ${list("names")}`;
 * // { names: ["Ada", "Grace", "Alan"] } renders "You invited Ada, Grace, and Alan"
 * ```
 */
export function list<const Name extends string>(
  name: Name,
  options?: Intl.ListFormatOptions,
): ToolKey<Name, string[]> {
  return tool(name, (value: string[], locale) =>
    listFormat(locale, options).format(value),
  );
}
