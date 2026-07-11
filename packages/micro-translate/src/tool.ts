const toolBrand = Symbol("micro-translate/tool");

export type ToolKey<Name extends string = string, V = unknown> = {
  [toolBrand]: true;
  name: Name;
  format: (
    value: unknown,
    locale: string | undefined,
    config: unknown,
  ) => string;
  readonly __value?: V;
};

export function tool<const Name extends string, V>(
  name: Name,
  format: (value: V, locale: string | undefined, config: unknown) => string,
): ToolKey<Name, V> {
  return {
    [toolBrand]: true,
    name,
    format: format as ToolKey["format"],
  };
}

export function isToolKey(value: unknown): value is ToolKey {
  return typeof value === "object" && value !== null && toolBrand in value;
}
