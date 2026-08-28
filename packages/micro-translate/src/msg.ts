import { isToolKey, type ToolKey } from "./tool";

const msgBrand = Symbol("micro-translate/msg");

/**
 * The branded template function produced by {@link msg}. You rarely name this
 * directly. It's what a `msg` interpolation resolves to inside a translation.
 */
export type Msg = ((dict: never, locale?: string) => unknown) & {
  [msgBrand]: true;
};

type TemplateKey = string | ToolKey<string, unknown, unknown>;

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
      Keys extends ToolKey<infer Name, infer V, unknown>
        ? unknown extends V
          ? // A recipe that never types its value infers V as unknown, meaning it
            // doesn't consume the value, so the key is optional at the call site.
            { [P in Name]?: V }
          : { [P in Name]: V }
        : Keys extends string
          ? NamedParam<Keys>
          : NoParams
    >;

type ToolOut<Keys> =
  Keys extends ToolKey<string, unknown, infer Out> ? Out : never;

// A template whose every interpolation renders to a string resolves to a plain
// string. One non-string recipe output and it resolves to an array of chunks
// (or a string, when every chunk still came out a string at runtime).
type MsgOutput<Keys extends readonly TemplateKey[]> = [
  Exclude<ToolOut<Keys[number]>, string>,
] extends [never]
  ? string
  : string | (string | ToolOut<Keys[number]>)[];

type MsgReturn<Keys extends readonly TemplateKey[]> = (
  dict: {
    // I know it's ugly inlining it like this, but it keeps the consumer side type clean
    [K in keyof FinalTemplateDict<Keys[number]>]: FinalTemplateDict<
      Keys[number]
    >[K];
  },
) => MsgOutput<Keys>;

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
 * The argument is an exact object literal, and a recipe that never types its
 * value makes its parameter optional. Keep every interpolated name a string
 * literal type: a name widened to `string` (e.g. a recipe missing
 * `<const Name extends string>`) melts the dict into an index signature, and
 * the keys are no longer checked.
 *
 * When every interpolation renders to a string the template resolves to a
 * string. A recipe that renders to something else (a React element, say) makes
 * the template resolve to an array of chunks instead, ready to hand to your
 * framework's renderer; when every chunk still comes out a string at runtime,
 * you get the joined string.
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
  const templateKeys: readonly TemplateKey[] = keys;

  const render = (
    // I know it's ugly inlining it like this, but it keeps the consumer side type clean
    dict: {
      [K in keyof FinalTemplateDict<Keys[number]>]: FinalTemplateDict<
        Keys[number]
      >[K];
    },
    locale?: string,
  ): unknown => {
    const values = dict as Record<PropertyKey, unknown>;
    const result: unknown[] = [strings[0]];
    let allStrings = true;

    for (const [i, key] of templateKeys.entries()) {
      if (isToolKey(key)) {
        const formatted = key.format(values[key.name] as never, locale);

        if (typeof formatted !== "string") {
          allStrings = false;
        }

        result.push(formatted, strings[i + 1]);

        continue;
      }

      result.push(String(values[key]), strings[i + 1]);
    }

    if (allStrings) {
      return result.join("");
    }

    // Merge adjacent strings and drop empties so consumers get the fewest
    // possible chunks.
    const chunks: unknown[] = [];

    for (const part of result) {
      if (part === "") {
        continue;
      }

      const last = chunks.at(-1);

      if (typeof part === "string" && typeof last === "string") {
        chunks[chunks.length - 1] = last + part;

        continue;
      }

      chunks.push(part);
    }

    return chunks;
  };

  Object.assign(render, { [msgBrand]: true });

  return render as MsgReturn<Keys>;
}
