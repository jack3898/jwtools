/**
 * Zod in the box. Nothing here touches zod at runtime: rows are typed as a
 * schema's input, and the adapter validates them through the schema.
 */
import type { z } from "zod";
import { type Adapter, type MemoryOptions, memory } from "./adapter";
import { seed as define, type SeedConfig, type SeedDefinition } from "./seeder";

/** Rows are the schema's input. A schema has no name, so the seed must set one. */
export function seed<
  S extends z.ZodObject,
  C extends SeedConfig,
  A extends object,
>(definition: SeedDefinition<S, z.input<S>, C, A>) {
  return define(definition);
}

/** `seed` for seeds that need extras: `X` is what `extend` must supply. */
export function seedWith<X extends object>() {
  return <S extends z.ZodObject, C extends SeedConfig, A extends object>(
    definition: SeedDefinition<S, z.input<S>, C, A, X>,
  ) => define(definition);
}

/**
 * In memory, with every row validated through its schema on the way in. Takes
 * the same `store` and `key` options as `memory()`.
 */
export function zodAdapter(
  options: Omit<MemoryOptions<z.ZodObject>, "parse"> = {},
): Adapter<z.ZodObject> {
  return memory<z.ZodObject>({
    ...options,
    parse: (schema, row) => schema.parse(row),
  });
}
