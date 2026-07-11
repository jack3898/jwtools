const toolBrand = Symbol("micro-translate/tool");

/**
 * The formatter key produced by a {@link tool} recipe: carries the parameter
 * `name` and, via `V`, the type its value must be at the call site. Interpolate
 * one into a {@link msg} template.
 */
export type ToolKey<Name extends string = string, V = unknown> = {
  [toolBrand]: true;
  name: Name;
  format: (value: never, locale: string | undefined) => string;
  readonly __value?: V;
};

export function tool<const Name extends string, V>(
  name: Name,
  format: (value: V, locale: string | undefined) => string,
): ToolKey<Name, V> {
  return { [toolBrand]: true, name, format };
}

export function isToolKey(value: unknown): value is ToolKey {
  return typeof value === "object" && value !== null && toolBrand in value;
}
