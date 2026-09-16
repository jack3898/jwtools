import type { SeedConfig } from "../seeder";

export function isPlainObject(value: unknown): value is SeedConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
