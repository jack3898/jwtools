import { en, Faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { engineSuite, harnessSeeds } from "./engine.suite";
import {
  seeder as define,
  type MemoryStore,
  memory,
  plant,
  type SeedConfig,
  type SeedDefinition,
} from "./index";

/** The README's Zod block, verbatim: pins the row type to the schema's input. */
function seeder<
  S extends z.ZodObject,
  C extends SeedConfig,
  A extends object,
  X extends object = object,
>(definition: SeedDefinition<S, z.input<S>, C, A, X>) {
  return define(definition);
}

const authorSchema = z.object({
  id: z.string(),
  name: z.string(),
  favouriteBookId: z.string().nullable().optional(),
});

const bookSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  title: z.string(),
});

const profileSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  bio: z.string(),
});

const store: MemoryStore<z.ZodObject> = new Map();
const adapter = memory<z.ZodObject>({
  store,
  parse: (schema, row) => schema.parse(row),
});

const { authors, books, profiles } = harnessSeeds<z.ZodObject>(
  { authors: authorSchema, books: bookSchema, profiles: profileSchema },
  { authors: "authors", books: "books", profiles: "profiles" },
);

engineSuite("zod schemas in memory", {
  adapter,
  authors,
  books,
  profiles,
  rows: (seed) =>
    Promise.resolve([...(store.get(seed.target)?.values() ?? [])]),
  reset: () => {
    store.clear();

    return Promise.resolve();
  },
});

describe("zod specifics", () => {
  it("validates every row through the schema", async () => {
    const strict = z.object({ name: z.string().min(3) });
    const tooShort = seeder({
      target: strict,
      name: "tooShort",
      build: () => [{ name: "ab" }],
    });

    await expect(plant(adapter, [tooShort])).rejects.toThrow(/Too small/);
  });

  it("requires a name, since a schema has none", async () => {
    const anonymous = seeder({
      target: z.object({}),
      build: () => [{}],
    });

    await expect(plant(adapter, [anonymous])).rejects.toThrow(
      "A seed on a target the adapter cannot name must set `name`",
    );
  });

  it("takes faker through extend, seeded from the run", async () => {
    type WithFaker = { readonly faker: Faker };

    function defineFakerSeed<
      S extends z.ZodObject,
      C extends SeedConfig,
      A extends object,
    >(definition: SeedDefinition<S, z.input<S>, C, A, WithFaker>) {
      return define(definition);
    }

    const people = defineFakerSeed({
      target: z.object({ name: z.string() }),
      name: "people",
      build: ({ faker }) =>
        Array.from({ length: 3 }, () => ({ name: faker.person.fullName() })),
    });

    const extend = ({ seed }: { seed: number }) => {
      const faker = new Faker({ locale: [en] });

      faker.seed(seed);

      return { faker };
    };
    const names = (rows: ReadonlyArray<{ name: string }>) =>
      rows.map((row) => row.name);

    const first = (await plant(adapter, [people], { extend })).handle(people);

    store.clear();

    const again = (await plant(adapter, [people], { extend })).handle(people);

    store.clear();

    const other = (
      await plant(adapter, [people], {
        extend,
        seed: 2,
      })
    ).handle(people);

    expect(names(again.all)).toEqual(names(first.all));
    expect(names(other.all)).not.toEqual(names(first.all));
  });
});
