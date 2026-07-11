import { isToolKey, type ToolKey } from "./tool";

const msgBrand = Symbol("micro-translate/msg");

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

type TemplateDict<Keys extends readonly TemplateKey[]> = {
  [K in keyof FinalTemplateDict<Keys[number]>]: FinalTemplateDict<
    Keys[number]
  >[K];
};

type MsgReturn<Keys extends readonly TemplateKey[]> = (
  dict: TemplateDict<Keys>,
) => string;

export function isMsg(value: unknown): value is Msg {
  return typeof value === "function" && msgBrand in value;
}

export function msg<const Keys extends readonly TemplateKey[]>(
  strings: TemplateStringsArray,
  ...keys: Keys
): MsgReturn<Keys> {
  const render = (dict: TemplateDict<Keys>, locale?: string): string => {
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
