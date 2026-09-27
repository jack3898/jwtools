# Power Seed (BETA)

The all-in-one data seeder! Type-safe, works with anything, deterministic & idempotent, dependency-aware, cross-platform.

## Installation

```sh
pnpm install @jack3898/power-seed
```

Zod and Drizzle support come out of the box.

## Requirements

Any runtime with ESM support. That includes web browsers!

## The idea in one file

```ts
import { seed, memory, plant } from "@jack3898/power-seed";

const teams = seed({
  target: "teams",
  defaults: { names: ["Red", "Blue"] },
  build: ({ config, id }) =>
    config.names.map((name) => ({ id: id(name), name })),
  accessors: ({ rows }) => ({
    byName: (name: string) => rows.find((team) => team.name === name),
  }),
});

const players = seed({
  target: "players",
  defaults: { perTeam: 3 },
  build: async ({ config, random, id, get }) => {
    const { all } = await get(teams); // this IS the dependency

    return all.flatMap((team) =>
      Array.from({ length: config.perTeam }, (_, index) => ({
        id: id(`${team.name}#${index}`),
        teamId: team.id,
        number: index + 1,
        rating: random.int({ min: 1, max: 99 }),
      })),
    );
  },
});

const adapter = memory();
const bed = await plant({
  into: adapter,
  seeds: [players.override({ perTeam: 2 })],
});

bed.handle(players).all; // every player row, as built
```

### What exactly is happening?

1. Each collection of data is defined by a `seed()`. A seed can represent a table in SQL, or a collection in NoSQL, or something else. It gives you the chance to define how the data is built for that part of your app, and also allows you to create parameters for the seed that alter how the build seeds with `defaults`.
2. `await get()` within your data builder gets the data for the other seed so that it can build what it needs. This is how you define dependencies to other seeds. If you removed `get()`, then the seed no longer depends on that other seed, and the dependency graph will adjust in the next run. This means that the seeder will seed in priority order starting at the leaves then working its way up the branches.
3. A `memory()` adapter was used. A memory adapter in this case is just a sink for the seed data. A adapter sort of acts like a passthrough, where data is sent to your database and also in memory for access in the JS runtime. The default `memory()` adapter skips that passthrough, and just stores the seeded data in memory as we have no database in this example.
4. We `plant()` the seeds! The seeds get planted into the memory adapter, and then we list each seed we want to plant in the `seeds` array. Using `bed.handle(players).all` we can get all of the players for that seed, as the seed has grown and you can now harvest your data.

## Bringing your schema

Out of the box this package ships with Drizzle and Zod support. More adapters are to come.

If an adapter is not yet supported, you can write your own and submit a PR.

### Zod

Rows are typed as the schema's input, and the adapter keeps them in memory, validating every row through `parse` on the way in:

```ts
import { plant } from "@jack3898/power-seed";
import { seed, zodAdapter } from "@jack3898/power-seed/zod";
import { z } from "zod";

const authorSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const authors = seed({
  target: authorSchema,
  name: "authors", // a schema has no name, so the seed must
  build: ({ id }) => [
    { id: id("ada"), name: "Ada" },
    { id: id("grace"), name: "Grace" },
  ],
});

const bed = await plant({ into: zodAdapter(), seeds: [authors] });
```

`zodAdapter` takes the same `store` and `key` options as `memory()`.

### Drizzle

Rows are typed by inferring from the table itself. The adapter that ships with this package is for Postgres. It reads each table's primary key from its columns, so any key column works, uuid or serial, whatever it is called, and it names each seed after its table in camelCase, so `week_number_systems` becomes `weekNumberSystems`:

```ts
import { plant } from "@jack3898/power-seed";
import { drizzleAdapter, seed } from "@jack3898/power-seed/drizzle";

const authors = seed({
  target: authorsTable,
  build: ({ id }) => [
    { id: id("ada"), name: "Ada" },
    { id: id("grace"), name: "Grace" },
  ],
});

await plant({ into: drizzleAdapter(db), seeds: [authors] });
```

## Faker and other extras

This library only comes with a handful of basic deterministic data generators. However, feel free to plug in your own randomization library for more power!

```ts
import { Faker, en } from "@faker-js/faker";
import { seedWith } from "@jack3898/power-seed/zod";

type WithFaker = { faker: Faker };

export const seed = seedWith<WithFaker>();

const people = seed({
  target: personSchema,
  name: "people",
  build: ({ faker }) =>
    Array.from({ length: 10 }, () => ({ name: faker.person.fullName() })),
});

await plant(
  { into: adapter, seeds: [people] },
  {
    extend: ({ seed: own }) => {
      const faker = new Faker({ locale: [en] });
      faker.seed(own);
      return { faker };
    },
  },
);
```

> NOTE: Keeping faker inside of the seeder rather than imported at the module level ensures the greatest level of idempotency.

## Ensure maximum determinism

A run is reproducible when every value derives from the run's inputs.

Use the built-in randomization toolkit and a third party library if need be to generate your data. Avoid things like `Math.random()`, `new Date()` as they are not deterministic and your seed data will change between runs. But, if that's what you want, then feel free to ignore this warning!

## More docs coming soon!

This package is in a beta state and is subject to big changes. For now, this README only covers the basic API, but there is more. Ask your agent about:

- Custom adapters
- Seed handles and accessors
- Dry runs
- Two-way data linking with `links`

The above will be fully documented here soon.
