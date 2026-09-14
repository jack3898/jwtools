/**
 * The two copy blocks from the README: a wrapper that pins the row type to
 * the schema's input and says what extras every seed may use, and an adapter.
 */
import { en, Faker } from "@faker-js/faker";
import {
  seeder as define,
  memory,
  type SeedConfig,
  type SeedDefinition,
} from "@jack3898/power-seed";
import type { z } from "zod";

/** What every seed gets on top of the toolkit. Supplied by `extend` per run. */
export type Extras = { faker: Faker };

export function seeder<
  S extends z.ZodObject,
  C extends SeedConfig,
  A extends object,
>(definition: SeedDefinition<S, z.input<S>, C, A, Extras>) {
  return define(definition);
}

export const adapter = memory<z.ZodObject>({
  // Every row is validated on the way in. Try making `pages` 0 in a factory.
  parse: (schema, row) => schema.parse(row),
});

/** Faker comes in through `extend`, seeded from the run so reruns match. */
export function extend({ seed }: { seed: number }): Extras {
  const faker = new Faker({ locale: [en] });

  faker.seed(seed);

  return { faker };
}
