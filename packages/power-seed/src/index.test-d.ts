/**
 * Checked by `tsc`, not Vitest: a failing assertion or an unused
 * `@ts-expect-error` is a compile error.
 */
import { type PgTable, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { expectTypeOf } from "expect-type";
import { z } from "zod";
import {
  type ConfigOf,
  type HandleOf,
  memory,
  plant,
  type SeedConfig,
  type SeedDefinition,
  seed,
  seedWith,
} from ".";
import { seed as drizzleSeed, seedWith as drizzleSeedWith } from "./drizzle";
import { zodAdapter, seed as zodSeed, seedWith as zodSeedWith } from "./zod";

// Grouping only. The bodies never run; `tsc` still checks them.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

const adapter = memory<string>();

const people = seed({
  target: "people",
  defaults: { count: 2, ages: { min: 18, max: 65 } },
  build: ({ config, random }) =>
    Array.from({ length: config.count }, () => ({
      name: "someone",
      age: random.int(config.ages),
    })),
  accessors: ({ rows }) => ({
    names: () => rows.map((person) => person.name),
  }),
});

describe("seed", () => {
  it("infers the row shape from what build returns", () => {
    expectTypeOf<HandleOf<typeof people>>().toMatchTypeOf<{
      names: () => Array<string>;
      all: ReadonlyArray<{ name: string; age: number }>;
      first: () => { name: string; age: number };
    }>();
  });

  it("exposes config with every key optional", () => {
    expectTypeOf<ConfigOf<typeof people>>().toEqualTypeOf<{
      readonly count?: number;
      readonly ages?: { readonly min?: number; readonly max?: number };
    }>();
  });

  it("types the handle a builder gets from a dependency", () => {
    seed({
      target: "pets",
      build: async ({ get }) => {
        const owners = await get(people);

        expectTypeOf(owners.names()).toEqualTypeOf<Array<string>>();
        expectTypeOf(owners.first().age).toEqualTypeOf<number>();

        return [{ owner: owners.first().name }];
      },
    });
  });

  it("lets a wrapper pin the row shape to a schema", () => {
    type Schema<T> = { readonly shape: T };

    function defineFor<
      S extends Schema<object>,
      C extends SeedConfig,
      A extends object,
    >(definition: SeedDefinition<S, S["shape"], C, A>) {
      return seed(definition);
    }

    const schema: Schema<{ title: string }> = { shape: { title: "" } };

    defineFor({ target: schema, build: () => [{ title: "ok" }] });

    defineFor({
      target: schema,
      // @ts-expect-error the row must match the schema's shape
      build: () => [{ title: 1 }],
    });
  });
});

describe("extras", () => {
  type WithFaker = { readonly faker: { readonly word: () => string } };

  const defineWithFaker = seedWith<WithFaker>();

  const words = defineWithFaker({
    target: "words",
    build: ({ faker }) => [{ word: faker.word() }],
  });

  const extend = () => ({ faker: { word: () => "w" } });

  it("must be supplied when a seed needs them", () => {
    // @ts-expect-error extend is required when the seed needs extras
    void plant({ into: adapter, seeds: [words] });
    void plant({ into: adapter, seeds: [words] }, { extend });
    void plant({ into: adapter, seeds: [people] }, { extend });
    void plant({ into: adapter, seeds: [people] });
  });

  it("flow down the tree but never up", () => {
    defineWithFaker({
      target: "fine",
      build: async ({ get }) => [{ n: (await get(people)).names().length }],
    });

    seed({
      target: "notFine",
      build: async ({ get }) => {
        // @ts-expect-error a seed needing extras cannot be pulled from one without them
        await get(words);

        return [];
      },
    });
  });

  it("are checked across every seed in seed", () => {
    void plant({ into: adapter, seeds: [people, words] }, { extend });
    // @ts-expect-error extend is required when any seed needs extras
    void plant({ into: adapter, seeds: [people, words] });
  });
});

describe("plant", () => {
  it("hands back a typed handle for any planted seed", async () => {
    const result = await plant({ into: adapter, seeds: [people] });

    expectTypeOf(result.handle(people).names()).toEqualTypeOf<Array<string>>();
    expectTypeOf(result.handle(people).first().age).toEqualTypeOf<number>();
    // @ts-expect-error only a planted seed has a handle
    result.handle(words);
  });

  it("types a link's update from the row it is handed", () => {
    seed({
      target: "pets",
      build: () => [{ name: "Rex", ownerName: "" }],
      link: async ({ rows, update, get }) => {
        const owners = await get(people);
        const [pet] = rows;

        await update(owners.first(), { age: 1 });

        if (pet) {
          // @ts-expect-error the wrong type for a column
          await update(pet, { name: 1 });
        }
      },
    });
  });

  it("types overrides from the seed", async () => {
    const bed = await plant({
      into: adapter,
      seeds: [people.override({ count: 1 })],
    });

    expectTypeOf(bed.handle(people).names()).toEqualTypeOf<Array<string>>();
    void plant({
      into: adapter,
      seeds: [people.override({ ages: { max: 40 } })],
    });
    // @ts-expect-error a key the seed does not declare
    people.override({ cuont: 1 });
    // @ts-expect-error the wrong type for a declared key
    people.override({ count: "1" });
  });
});

describe("adapters", () => {
  it("must match the seeds' target type", () => {
    const objects = memory<{ readonly table: string }>();

    // @ts-expect-error a seed on a string target cannot run through an adapter for objects
    void plant({ into: objects, seeds: [people] });
  });

  it("expose nothing beyond the adapter contract", () => {
    // @ts-expect-error rows come back through handles, not the adapter
    adapter.rows;
    // @ts-expect-error the caller's own store is the only way to inspect it
    adapter.clear;
  });
});

describe("subpaths", () => {
  const schema = z.object({ title: z.string() });
  const things = pgTable("things", {
    id: uuid().primaryKey(),
    title: text().notNull(),
  });

  it("type zod rows as the schema's input", () => {
    zodSeed({ target: schema, name: "fine", build: () => [{ title: "ok" }] });
    zodSeed({
      target: schema,
      name: "notFine",
      // @ts-expect-error the row must match the schema's input
      build: () => [{ title: 1 }],
    });
  });

  it("type drizzle rows as the table's insert model", () => {
    drizzleSeed({
      target: things,
      build: ({ id }) => [{ id: id("1"), title: "ok" }],
    });
    drizzleSeed({
      target: things,
      // @ts-expect-error the row must match the table's insert model
      build: ({ id }) => [{ id: id("1"), title: 1 }],
    });
  });

  it("pin extras on each subpath", () => {
    type WithFaker = { readonly faker: { readonly word: () => string } };

    const zodWords = zodSeedWith<WithFaker>()({
      target: schema,
      name: "words",
      build: ({ faker }) => [{ title: faker.word() }],
    });
    const drizzleWords = drizzleSeedWith<WithFaker>()({
      target: things,
      build: ({ id, faker }) => [{ id: id("1"), title: faker.word() }],
    });

    // @ts-expect-error extend is required when the seed needs extras
    void plant({ into: zodAdapter(), seeds: [zodWords] });
    // @ts-expect-error extend is required when the seed needs extras
    void plant({ into: memory<PgTable>(), seeds: [drizzleWords] });
  });
});
