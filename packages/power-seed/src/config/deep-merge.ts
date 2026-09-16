import type { SeedConfig } from "../seeder";
import { isPlainObject } from "./is-plain-object";

/** Nested objects merge. Arrays replace: a partial weighting means nothing. */
export function deepMerge(
  defaults: SeedConfig,
  overrides: SeedConfig,
): SeedConfig {
  const merged: SeedConfig = { ...defaults };

  for (const [key, value] of Object.entries(overrides)) {
    const existing = defaults[key];

    merged[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? deepMerge(existing, value)
        : value;
  }

  return merged;
}
