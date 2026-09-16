/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest; they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { expectTypeOf } from "expect-type";
import {
  type ConfigOf,
  type HandleOf,
  memory,
  plant,
  type SeedConfig,
  type SeedDefinition,
  seeder,
} from ".";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

const adapter = memory<string>();

const people = seeder({
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

describe("seeder", () => {
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
    seeder({
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
      return seeder(definition);
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

  function defineWithFaker<
    C extends SeedConfig,
    A extends object,
    Insert extends object,
  >(definition: SeedDefinition<string, Insert, C, A, WithFaker>) {
    return seeder(definition);
  }

  const words = defineWithFaker({
    target: "words",
    build: ({ faker }) => [{ word: faker.word() }],
  });

  const extend = () => ({ faker: { word: () => "w" } });

  it("must be supplied when a seed needs them", () => {
    // @ts-expect-error extend is required when the seed needs extras
    void plant(adapter, [words]);
    void plant(adapter, [words], { extend });
    void plant(adapter, [people], { extend });
    void plant(adapter, [people]);
  });

  it("flow down the tree but never up", () => {
    defineWithFaker({
      target: "fine",
      build: async ({ get }) => [{ n: (await get(people)).names().length }],
    });

    seeder({
      target: "notFine",
      build: async ({ get }) => {
        // @ts-expect-error a seed needing extras cannot be pulled from one without them
        await get(words);

        return [];
      },
    });
  });

  it("are checked across every seed in seed", () => {
    void plant(adapter, [people, words], { extend });
    // @ts-expect-error extend is required when any seed needs extras
    void plant(adapter, [people, words]);
  });
});

describe("seed", () => {
  it("hands back a typed handle for any planted seed", async () => {
    const result = await plant(adapter, [people]);

    expectTypeOf(result.handle(people).names()).toEqualTypeOf<Array<string>>();
    expectTypeOf(result.handle(people).first().age).toEqualTypeOf<number>();
    // @ts-expect-error only a planted seed has a handle
    result.handle(words);
  });

  it("types a link's update from the row it is handed", () => {
    seeder({
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
    const bed = await plant(adapter, [people.override({ count: 1 })]);

    // Planted with overrides, found by the seed itself.
    expectTypeOf(bed.handle(people).names()).toEqualTypeOf<Array<string>>();
    void plant(adapter, [people.override({ ages: { max: 40 } })]);
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
    void plant(objects, [people]);
  });

  it("expose nothing beyond the adapter contract", () => {
    // @ts-expect-error rows come back through handles, not the adapter
    adapter.rows;
    // @ts-expect-error the caller's own store is the only way to inspect it
    adapter.clear;
  });
});
