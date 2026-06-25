import { getPluralRules, isPluralKey, type PluralKey } from "./plural";

const msgBrand = Symbol("micro-translate/msg");

/**
 * A branded template renderer produced by {@link msg}. The active locale is
 * injected by the translator, so the public {@link msg} signature hides it and
 * callers only pass the dict.
 */
export type Msg = ((dict: never, locale?: string) => string) & {
  [msgBrand]: true;
};

type TemplateKey = string | PluralKey;

type UnionToIntersection<U> = (
  U extends unknown
    ? (arg: U) => void
    : never
) extends (arg: infer I) => void
  ? I
  : never;

type PluralParam<Name extends string> = { [P in Name]: number };

type NamedParam<Key extends string> = { [P in Key]: string | number };

type NoParams = Record<never, never>;

type FinalTemplateDict<Keys> = [Keys] extends [never]
  ? NoParams
  : UnionToIntersection<
      Keys extends PluralKey<infer Name>
        ? PluralParam<Name>
        : Keys extends string
          ? NamedParam<Keys>
          : NoParams
    >;

export function isMsg(value: unknown): value is Msg {
  return typeof value === "function" && msgBrand in value;
}

export function msg<const Keys extends readonly TemplateKey[]>(
  strings: TemplateStringsArray,
  ...keys: Keys
): (
  dict: {
    // Inlined `{ [K in keyof T]: T[K] }` flattens the computed dict (which is
    // built from intersections internally) into a single object literal, so it
    // hovers as the resolved shape instead of `A & B`.
    [K in keyof FinalTemplateDict<Keys[number]>]: FinalTemplateDict<
      Keys[number]
    >[K];
  },
) => string {
  const render = (
    dict: {
      [K in keyof FinalTemplateDict<Keys[number]>]: FinalTemplateDict<
        Keys[number]
      >[K];
    },
    locale?: string,
  ): string => {
    const values = dict as Record<PropertyKey, string | number>;
    const result = [strings[0]];

    for (const [i, key] of keys.entries()) {
      if (isPluralKey(key)) {
        const count = Number(values[key.name]);
        const category = getPluralRules(locale).select(count);

        result.push(
          key.variants[category] ?? key.variants.other,
          strings[i + 1],
        );

        continue;
      }

      result.push(String(values[key]), strings[i + 1]);
    }

    return result.join("");
  };

  Object.assign(render, { [msgBrand]: true });

  // The locale is injected by the translator; the return-type annotation omits
  // it from the public signature, so callers only pass the dict.
  return render;
}
