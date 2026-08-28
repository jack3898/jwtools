const toolBrand = Symbol("micro-translate/tool");

/**
 * The formatter key produced by a {@link tool} recipe: carries the parameter
 * `name`, via `V` the type its value must be at the call site, and via `Out`
 * what the recipe renders to. Interpolate one into a {@link msg} template.
 *
 * `Out` defaults to `string`. A recipe may render to anything else (a React
 * element, a VNode, an object); a template containing such a recipe resolves to
 * an array of chunks instead of a joined string.
 */
export type ToolKey<Name extends string = string, V = unknown, Out = string> = {
  [toolBrand]: true;
  name: Name;
  format: (value: never, locale: string | undefined) => Out;
  readonly __value?: V;
};

export function tool<const Name extends string, V, Out>(
  name: Name,
  format: (value: V, locale: string | undefined) => Out,
): ToolKey<Name, V, Out> {
  return { [toolBrand]: true, name, format };
}

export function isToolKey(
  value: unknown,
): value is ToolKey<string, unknown, unknown> {
  return typeof value === "object" && value !== null && toolBrand in value;
}
