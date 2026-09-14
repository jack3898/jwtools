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
  defineSeed,
  type HandleOf,
  memoryAdapter,
  type Row,
  type SeedConfig,
  type SeedDefinition,
  seed,
} from ".";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

const adapter = memoryAdapter<string>();

const people = defineSeed({
  target: "people",
  defaults: { count: 2, ages: { min: 18, max: 65 } },
  build: ({ config, random }) =>
    Array.from({ length: config.count }, () => ({
      name: "someone",
      age: random.int(config.ages),
    })),
  accessors: ({ rows }) => ({
    names: () => rows.map((person) => person.row.name),
  }),
});

describe("defineSeed", () => {
  it("infers the row shape from what build returns", () => {
    expectTypeOf<HandleOf<typeof people>>().toMatchTypeOf<{
      names: () => Array<string>;
      all: ReadonlyArray<Row<{ name: string; age: number }>>;
      first: () => Row<{ name: string; age: number }>;
    }>();
  });

  it("exposes config with every key optional", () => {
    expectTypeOf<ConfigOf<typeof people>>().toEqualTypeOf<{
      readonly count?: number;
      readonly ages?: { readonly min?: number; readonly max?: number };
    }>();
  });

  it("types the handle a builder gets from a dependency", () => {
    defineSeed({
      target: "pets",
      build: async ({ get }) => {
        const owners = await get(people);

        expectTypeOf(owners.names()).toEqualTypeOf<Array<string>>();
        expectTypeOf(owners.first().row.age).toEqualTypeOf<number>();

        return [{ ownerId: owners.first().id }];
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
      return defineSeed(definition);
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
    return defineSeed(definition);
  }

  const words = defineWithFaker({
    target: "words",
    build: ({ faker }) => [{ word: faker.word() }],
  });

  const extend = () => ({ faker: { word: () => "w" } });

  it("must be supplied when a seed needs them", () => {
    // @ts-expect-error extend is required when the seed needs extras
    void seed(adapter, [{ seeder: words }]);
    void seed(adapter, [{ seeder: words }], { extend });
    void seed(adapter, [{ seeder: people }], { extend });
    void seed(adapter, [{ seeder: people }]);
  });

  it("flow down the tree but never up", () => {
    defineWithFaker({
      target: "fine",
      build: async ({ get }) => [{ n: (await get(people)).names().length }],
    });

    defineSeed({
      target: "notFine",
      build: async ({ get }) => {
        // @ts-expect-error a seed needing extras cannot be pulled from one without them
        await get(words);

        return [];
      },
    });
  });

  it("are checked across every seed in seed", () => {
    void seed(adapter, [{ seeder: people }, { seeder: words }], { extend });
    // @ts-expect-error extend is required when any seed needs extras
    void seed(adapter, [{ seeder: people }, { seeder: words }]);
  });
});

describe("seed", () => {
  it("hands back a typed handle for any listed seed", async () => {
    const result = await seed(adapter, [{ seeder: people }]);

    expectTypeOf(result.handle(people).names()).toEqualTypeOf<Array<string>>();
    expectTypeOf(result.handle(people).first().row.age).toEqualTypeOf<number>();
    // @ts-expect-error only a listed seed has a handle
    result.handle(words);
  });

  it("types each entry's config from its seeder", () => {
    void seed(adapter, [{ seeder: people, config: { count: 1 } }]);
    void seed(adapter, [{ seeder: people, config: { ages: { max: 40 } } }]);
    // @ts-expect-error a key the seed does not declare
    void seed(adapter, [{ seeder: people, config: { cuont: 1 } }]);
    // @ts-expect-error the wrong type for a declared key
    void seed(adapter, [{ seeder: people, config: { count: "1" } }]);
  });
});

describe("adapters", () => {
  it("must match the seeds' target type", () => {
    const objects = memoryAdapter<{ readonly table: string }>();

    // @ts-expect-error a seed on a string target cannot run through an adapter for objects
    void seed(objects, [{ seeder: people }]);
  });

  it("expose nothing beyond the adapter contract", () => {
    // @ts-expect-error rows come back through handles, not the adapter
    adapter.rows;
    // @ts-expect-error the caller's own store is the only way to inspect it
    adapter.clear;
  });
});
