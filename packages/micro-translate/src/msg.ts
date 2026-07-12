import { isToolKey, type ToolKey } from "./tool";

const msgBrand = Symbol("micro-translate/msg");

/**
 * The branded template function produced by {@link msg}. You rarely name this
 * directly. It's what a `msg` interpolation resolves to inside a translation.
 */
export type Msg = ((dict: never, locale?: string) => string) & {
  [msgBrand]: true;
};

type TemplateKey = string | ToolKey;

type UnionToIntersection<U> = (
  U extends unknown
    ? (arg: U) => void
    : never
) extends (arg: infer I) => void
  ? I
  : never;

type NamedParam<Key extends string> = { [P in Key]: string | number };

type NoParams = Record<never, never>;

type FinalTemplateDict<Keys> = [Keys] extends [never]
  ? NoParams
  : UnionToIntersection<
      Keys extends ToolKey<infer Name, infer V>
        ? { [P in Name]: V }
        : Keys extends string
          ? NamedParam<Keys>
          : NoParams
    >;

type MsgReturn<Keys extends readonly TemplateKey[]> = (
  dict: {
    // I know it's ugly inlining it like this, but it keeps the consumer side type clean
    [K in keyof FinalTemplateDict<Keys[number]>]: FinalTemplateDict<
      Keys[number]
    >[K];
  },
) => string;

export function isMsg(value: unknown): value is Msg {
  return typeof value === "function" && msgBrand in value;
}

/**
 * A tagged template for translations with named, type-inferred parameters.
 *
 * Interpolate a string literal for a plain named parameter, or a formatter key
 * from a recipe like {@link plural}/{@link num}/{@link tool}. The parameter names
 * and types are inferred from what you interpolate and become the argument to the
 * resolved template function.
 *
 * @example ```ts
 * const greet = msg`Hey ${"name"}`;
 * greet({ name: "Ada" }); // "Hey Ada", infers { name: string | number }
 * ```
 */
export function msg<const Keys extends readonly TemplateKey[]>(
  strings: TemplateStringsArray,
  ...keys: Keys
): MsgReturn<Keys> {
  const render = (
    // I know it's ugly inlining it like this, but it keeps the consumer side type clean
    dict: {
      [K in keyof FinalTemplateDict<Keys[number]>]: FinalTemplateDict<
        Keys[number]
      >[K];
    },
    locale?: string,
  ): string => {
    const values = dict as Record<PropertyKey, unknown>;
    const result = [strings[0]];

    for (const [i, key] of keys.entries()) {
      if (isToolKey(key)) {
        result.push(
          key.format(values[key.name] as never, locale),
          strings[i + 1],
        );

        continue;
      }

      result.push(String(values[key]), strings[i + 1]);
    }

    return result.join("");
  };

  Object.assign(render, { [msgBrand]: true });

  return render as MsgReturn<Keys>;
}
