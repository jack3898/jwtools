import type { PluralRule } from "./plural";

const ordinalBrand = Symbol("micro-translate/ordinal");

/**
 * The suffix strings for an ordinal, keyed by the ordinal plural category for a
 * locale (English: `one`→"st", `two`→"nd", `few`→"rd", `other`→"th"). `other` is
 * the required fallback. Declared per-language in `createTranslationConfig`'s
 * `ordinals`, because ordinal suffixes are a property of the language, not of
 * any single message.
 */
export type OrdinalVariants = Partial<Record<PluralRule, string>> & {
  other: string;
};

export type OrdinalKey<Name extends string = string> = {
  [ordinalBrand]: true;
  name: Name;
};

/**
 * A purely type-level marker. {@link msg} intersects its return type with this
 * whenever a template uses {@link ordinal}, which lets `define` reject that
 * template at compile time unless the config declared `ordinals`. It is never
 * set at runtime and is stripped from the resolved translator type.
 */
export type RequiresOrdinals = { readonly __requiresOrdinals: true };

/**
 * Declares an ordinal template parameter. Inside a `msg`, the named parameter is
 * typed as a `number` and renders as the number plus its locale's ordinal suffix
 * (e.g. `1` → "1st"). The suffixes come from the `ordinals` table in
 * {@link createTranslationConfig}; using `ordinal()` without configuring
 * `ordinals` is a compile error.
 *
 * @example ```ts
 * msg`You came ${ordinal("place")}`; // place: 1 -> "You came 1st"
 * ```
 *
 * @param name The parameter name; its value must be a `number`
 */
export function ordinal<const Name extends string>(
  name: Name,
): OrdinalKey<Name> {
  return { [ordinalBrand]: true, name };
}

export function isOrdinalKey(key: unknown): key is OrdinalKey {
  return typeof key === "object" && key !== null && ordinalBrand in key;
}
