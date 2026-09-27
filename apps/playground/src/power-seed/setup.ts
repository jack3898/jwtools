/**
 * The Zod subpath supplies both pieces: a `seed` pinned to the extras every
 * seed may use, and an adapter that validates every row on the way in.
 */
import { en, Faker } from "@faker-js/faker";
import { seedWith, zodAdapter } from "@jack3898/power-seed/zod";

/** What every seed gets on top of the toolkit. Supplied by `extend` per run. */
export type Extras = { faker: Faker };

export const seed = seedWith<Extras>();

// Every row is validated on the way in. Try making `pages` 0 in a factory.
export const adapter = zodAdapter();

/** Faker comes in through `extend`, seeded from the run so reruns match. */
export function extend({ seed: own }: { seed: number }): Extras {
  const faker = new Faker({ locale: [en] });

  faker.seed(own);

  return { faker };
}
