import { en, Faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ADJECTIVES, engineSuite, NOUNS } from "./engine.suite";
import {
  defineSeed as define,
  type MemoryStore,
  memoryAdapter,
  type SeedConfig,
  type SeedDefinition,
  seed,
} from "./index";

/** The README's Zod block, verbatim: pins the row type to the schema's input. */
function defineSeed<
  S extends z.ZodObject,
  C extends SeedConfig,
  A extends object,
  X extends object = object,
>(definition: SeedDefinition<S, z.input<S>, C, A, X>) {
  return define(definition);
}

const authorSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  favouriteBookId: z.string().nullable().optional(),
});

const bookSchema = z.object({
  id: z.string().optional(),
  authorId: z.string(),
  title: z.string(),
});

const profileSchema = z.object({
  id: z.string().optional(),
  authorId: z.string(),
  bio: z.string(),
});

const store: MemoryStore<z.ZodObject> = new Map();
const adapter = memoryAdapter<z.ZodObject>({
  store,
  parse: (schema, row) => schema.parse(row),
});

const authors = defineSeed({
  target: authorSchema,
  name: "authors",
  defaults: { count: 3 },
  build: ({ config }) =>
    Array.from({ length: config.count }, (_, index) => ({
      name: `Author ${index + 1}`,
    })),
  accessors: ({ rows }) => ({
    byName: (name: string) => {
      const found = rows.find((author) => author.row.name === name);

      if (!found) {
        throw new Error(`No author named "${name}"`);
      }

      return found;
    },
  }),
});

const books = defineSeed({
  target: bookSchema,
  name: "books",
  defaults: { perAuthor: 2 },
  build: async ({ config, random, get }) => {
    const { all } = await get(authors);

    return all.flatMap((author) =>
      Array.from({ length: config.perAuthor }, () => ({
        authorId: author.id,
        title: `${random.pick(ADJECTIVES)} ${random.pick(NOUNS)}`,
      })),
    );
  },
  accessors: ({ rows }) => ({
    forAuthor: (authorId: string) =>
      rows.filter((book) => book.row.authorId === authorId),
  }),
  // authors.favouriteBookId points at books, which point back at authors, so
  // it can only be set once both are in.
  link: async ({ get, rows, updateIn }) => {
    const { all } = await get(authors);

    for (const author of all) {
      const first = rows.find((book) => book.row.authorId === author.id);

      if (first) {
        await updateIn(authors, author.id, { favouriteBookId: first.id });
      }
    }
  },
});

const profiles = defineSeed({
  target: profileSchema,
  name: "profiles",
  build: async ({ get }) => {
    const { all } = await get(authors);

    return all.map((author) => ({
      authorId: author.id,
      bio: `About ${author.row.name}`,
    }));
  },
});

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
    const strict = z.object({
      id: z.string().optional(),
      name: z.string().min(3),
    });
    const tooShort = defineSeed({
      target: strict,
      name: "tooShort",
      build: () => [{ name: "ab" }],
    });

    await expect(seed(adapter, [{ seeder: tooShort }])).rejects.toThrow(
      /Too small/,
    );
  });

  it("requires a name, since a schema has none", async () => {
    const anonymous = defineSeed({
      target: z.object({ id: z.string().optional() }),
      build: () => [{}],
    });

    await expect(seed(adapter, [{ seeder: anonymous }])).rejects.toThrow(
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
      target: z.object({ id: z.string().optional(), name: z.string() }),
      name: "people",
      build: ({ faker }) =>
        Array.from({ length: 3 }, () => ({ name: faker.person.fullName() })),
    });

    const extend = ({ seed }: { seed: number }) => {
      const faker = new Faker({ locale: [en] });

      faker.seed(seed);

      return { faker };
    };
    const names = (rows: ReadonlyArray<{ row: { name: string } }>) =>
      rows.map(({ row }) => row.name);

    const first = (
      await seed(adapter, [{ seeder: people }], { extend })
    ).handle(people);

    store.clear();

    const again = (
      await seed(adapter, [{ seeder: people }], { extend })
    ).handle(people);

    store.clear();

    const other = (
      await seed(adapter, [{ seeder: people }], {
        extend,
        seed: 2,
      })
    ).handle(people);

    expect(names(again.all)).toEqual(names(first.all));
    expect(names(other.all)).not.toEqual(names(first.all));
  });
});
