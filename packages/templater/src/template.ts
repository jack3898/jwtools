export const $ = Symbol("template-placeholder");

type TemplateKey = string | number | typeof $;

export function template<K extends TemplateKey>(
  strings: TemplateStringsArray,
  ...keys: Array<K>
) {
  return (
    dict: { [Key in K as Key extends typeof $ ? number : Key]: string },
  ): string => {
    const result = [strings[0]];

    for (const [i, key] of keys.entries()) {
      if (key === $ && Array.isArray(dict)) {
        result.push(dict[i], strings[i + 1]);

        continue;
      }

      if (typeof key !== "symbol" && hasNoSymbols(dict)) {
        result.push(dict[key], strings[i + 1]);
      }
    }

    return result.join("");
  };
}

function hasNoSymbols<T>(obj: T): obj is Exclude<T, Record<symbol, unknown>> {
  return Object.getOwnPropertySymbols(obj).length === 0;
}
