import { en, Faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { engineSuite, harnessSeeds } from "./engine.suite";
import { type MemoryStore, plant } from "./index";
import { seed, seedWith, zodAdapter } from "./zod";

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
const adapter = zodAdapter({ store });

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
    const tooShort = seed({
      target: strict,
      name: "tooShort",
      build: () => [{ name: "ab" }],
    });

    await expect(plant({ into: adapter, seeds: [tooShort] })).rejects.toThrow(
      /Too small/,
    );
  });

  it("requires a name, since a schema has none", async () => {
    const anonymous = seed({
      target: z.object({}),
      build: () => [{}],
    });

    await expect(plant({ into: adapter, seeds: [anonymous] })).rejects.toThrow(
      "A seed on a target the adapter cannot name must set `name`",
    );
  });

  it("takes faker through extend, seeded from the run", async () => {
    type WithFaker = { readonly faker: Faker };

    const seedWithFaker = seedWith<WithFaker>();

    const people = seedWithFaker({
      target: z.object({ name: z.string() }),
      name: "people",
      build: ({ faker }) =>
        Array.from({ length: 3 }, () => ({ name: faker.person.fullName() })),
    });

    const extend = ({ seed: own }: { seed: number }) => {
      const faker = new Faker({ locale: [en] });

      faker.seed(own);

      return { faker };
    };
    const names = (rows: ReadonlyArray<{ name: string }>) =>
      rows.map((row) => row.name);

    const first = (
      await plant({ into: adapter, seeds: [people] }, { extend })
    ).handle(people);

    store.clear();

    const again = (
      await plant({ into: adapter, seeds: [people] }, { extend })
    ).handle(people);

    store.clear();

    const other = (
      await plant(
        { into: adapter, seeds: [people] },
        {
          extend,
          seed: 2,
        },
      )
    ).handle(people);

    expect(names(again.all)).toEqual(names(first.all));
    expect(names(other.all)).not.toEqual(names(first.all));
  });
});
