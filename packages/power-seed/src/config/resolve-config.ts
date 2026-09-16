import type { SeedConfig } from "../seeder";
import { deepMerge } from "./deep-merge";

/** Without the key check a misspelt key would silently read as the default. */
export function resolveConfig(
  name: string,
  defaults: SeedConfig | undefined,
  provided: SeedConfig,
): SeedConfig {
  const claimed = defaults ?? {};
  const unknown = Object.keys(provided).filter((key) => !(key in claimed));

  if (unknown.length > 0) {
    throw new Error(
      `Seed "${name}" has no config named: ${unknown.join(", ")}. Accepts: ${Object.keys(claimed).sort().join(", ")}`,
    );
  }

  return deepMerge(claimed, provided);
}
