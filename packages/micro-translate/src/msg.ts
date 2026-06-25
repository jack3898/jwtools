import {
  isOrdinalKey,
  type OrdinalKey,
  type OrdinalVariants,
  type RequiresOrdinals,
} from "./ordinal";
import { getPluralRules, isPluralKey, type PluralKey } from "./plural";

const msgBrand = Symbol("micro-translate/msg");

/**
 * A branded template renderer produced by {@link msg}. The active locale and the
 * locale's ordinal suffixes are injected by the translator, so the public
 * {@link msg} signature hides them and callers only pass the dict.
 */
export type Msg = ((
  dict: never,
  locale?: string,
  ordinals?: OrdinalVariants,
) => string) & {
  [msgBrand]: true;
};

type TemplateKey = string | PluralKey | OrdinalKey;

type UnionToIntersection<U> = (
  U extends unknown
    ? (arg: U) => void
    : never
) extends (arg: infer I) => void
  ? I
  : never;

type NumberParam<Name extends string> = { [P in Name]: number };

type NamedParam<Key extends string> = { [P in Key]: string | number };

type NoParams = Record<never, never>;

type FinalTemplateDict<Keys> = [Keys] extends [never]
  ? NoParams
  : UnionToIntersection<
      Keys extends PluralKey<infer Name>
        ? NumberParam<Name>
        : Keys extends OrdinalKey<infer Name>
          ? NumberParam<Name>
          : Keys extends string
            ? NamedParam<Keys>
            : NoParams
    >;

// Inlined `{ [K in keyof T]: T[K] }` flattens the computed dict (which is built
// from intersections internally) into a single object literal, so it hovers as
// the resolved shape instead of `A & B`.
type TemplateDict<Keys extends readonly TemplateKey[]> = {
  [K in keyof FinalTemplateDict<Keys[number]>]: FinalTemplateDict<
    Keys[number]
  >[K];
};

// Does the template use an ordinal? Drives the compile-time `ordinals`
// requirement via the {@link RequiresOrdinals} phantom marker.
type HasOrdinal<Keys> = Extract<Keys, OrdinalKey> extends never ? false : true;

type MsgReturn<Keys extends readonly TemplateKey[]> = ((
  dict: TemplateDict<Keys>,
) => string) &
  (HasOrdinal<Keys[number]> extends true ? RequiresOrdinals : unknown);

export function isMsg(value: unknown): value is Msg {
  return typeof value === "function" && msgBrand in value;
}

export function msg<const Keys extends readonly TemplateKey[]>(
  strings: TemplateStringsArray,
  ...keys: Keys
): MsgReturn<Keys> {
  const render = (
    dict: TemplateDict<Keys>,
    locale?: string,
    ordinals?: OrdinalVariants,
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

      if (isOrdinalKey(key)) {
        const count = Number(values[key.name]);

        if (!ordinals) {
          throw new Error(
            `❌ ordinal("${key.name}") used but no "ordinals" configured for locale "${locale}"`,
          );
        }

        const category = getPluralRules(locale, "ordinal").select(count);

        result.push(
          `${count}${ordinals[category] ?? ordinals.other}`,
          strings[i + 1],
        );

        continue;
      }

      result.push(String(values[key]), strings[i + 1]);
    }

    return result.join("");
  };

  Object.assign(render, { [msgBrand]: true });

  // The locale and ordinals are injected by the translator; the return-type
  // annotation omits them, so callers only pass the dict. The cast bridges the
  // concrete render to the phantom-carrying public type.
  return render as MsgReturn<Keys>;
}
