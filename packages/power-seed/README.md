# Power Seed

Dependency-aware data seeding with zero dependencies. Bring your own schema and your own driver.

Seeds ask for each other, so the dependency graph is whatever your builders call. Every id is a pure function of identity, so a rerun is a no-op and a dry run computes the exact rows a real run inserts. Nothing in the package knows what a table is: a Drizzle table, a Kysely table name, a Zod schema, or a plain string all work, because the engine only ever hands the target to an adapter you supply.

## Installation

```sh
pnpm install @jack3898/power-seed
```

## Requirements

Any runtime with ESM support. The package has no dependencies and touches no platform globals, so it runs in Node, Bun, Deno, workers and browsers alike.

## The idea in one file

```ts
import { defineSeed, memoryAdapter, seedOne } from "@jack3898/power-seed";

const teams = defineSeed({
  target: "teams",
  defaults: { names: ["Red", "Blue"] },
  build: ({ config }) => config.names.map((name) => ({ name })),
  accessors: ({ rows }) => ({
    byName: (name: string) => rows.find((team) => team.row.name === name),
  }),
});

const players = defineSeed({
  target: "players",
  defaults: { perTeam: 3 },
  build: async ({ config, random, get }) => {
    const { all } = await get(teams); // this IS the dependency

    return all.flatMap((team) =>
      Array.from({ length: config.perTeam }, (_, index) => ({
        teamId: team.id,
        number: index + 1,
        rating: random.int({ min: 1, max: 99 }),
      })),
    );
  },
});

const adapter = memoryAdapter<string>();
const handle = await seedOne(adapter, players, { players: { perTeam: 2 } });

handle.all; // every player row, with its id
adapter.rows(teams); // seeded on the way, because players asked for it
```

Three things happened there:

- **`players` pulled `teams` in** by calling `get(teams)`. There is no dependency list to keep in sync with the code.
- **Every row got a stable id** derived from its seed name and index. Run it again and the same ids are offered, and the adapter keeps the rows already there.
- **`random.int` drew from a stream seeded once for the run.** The same seed gives the same ratings, every time, on every machine.

## Bringing your schema

The `target` field is opaque to the engine. Two small pieces of code, both yours to copy, make any schema library a first-class citizen: a typed `defineSeed` wrapper that pins the row type to the target, and an adapter that knows how to write to it. Both are checked verbatim in this package's test suite against real libraries, as dev dependencies only.

### Zod

Rows are typed as the schema's input, and the memory adapter validates every row through `parse`:

```ts
import {
  defineSeed as define,
  memoryAdapter,
  type SeedConfig,
  type SeedDefinition,
} from "@jack3898/power-seed";
import { z } from "zod";

export function defineSeed<
  S extends z.ZodObject,
  C extends SeedConfig,
  A extends object,
  X extends object = object,
>(definition: SeedDefinition<S, z.input<S>, C, A, X>) {
  return define(definition);
}

export const adapter = memoryAdapter<z.ZodObject>({
  parse: (schema, row) => schema.parse(row),
});
```

```ts
const authorSchema = z.object({
  id: z.string().optional(), // the engine supplies one
  name: z.string(),
});

const authors = defineSeed({
  target: authorSchema,
  name: "authors", // a schema has no name, so the seed must
  build: () => [{ name: "Ada" }, { name: "Grace" }],
});
```

### Drizzle

Rows are typed as the table's insert model, and the adapter uses Drizzle's conflict handling to make reruns idempotent:

```ts
import {
  type Adapter,
  defineSeed as define,
  type SeedConfig,
  type SeedDefinition,
} from "@jack3898/power-seed";
import {
  eq,
  getTableColumns,
  getTableName,
  type InferInsertModel,
  inArray,
} from "drizzle-orm";
import type {
  PgDatabase,
  PgQueryResultHKT,
  PgTable,
} from "drizzle-orm/pg-core";

export function defineSeed<
  T extends PgTable,
  C extends SeedConfig,
  A extends object,
  X extends object = object,
>(definition: SeedDefinition<T, InferInsertModel<T>, C, A, X>) {
  return define(definition);
}

export function drizzleAdapter(
  db: PgDatabase<PgQueryResultHKT>,
): Adapter<PgTable> {
  const BATCH = 1000;

  function idColumn(table: PgTable) {
    const column = getTableColumns(table)["id"];

    if (!column) {
      throw new Error(`${getTableName(table)} has no id column`);
    }

    return column;
  }

  return {
    nameOf: (table) => getTableName(table),

    // Drizzle drops keys a table lacks, so tables without timestamps are fine.
    stamp: ({ now }) => ({ createdAt: now, updatedAt: now }),

    insert: async (table, rows) => {
      let written = 0;

      for (let start = 0; start < rows.length; start += BATCH) {
        const inserted = await db
          .insert(table)
          .values([...rows.slice(start, start + BATCH)])
          .onConflictDoNothing()
          .returning({ id: idColumn(table) });

        written += inserted.length;
      }

      return written;
    },

    present: async (table, ids) => {
      const found = await db
        .select({ id: idColumn(table) })
        .from(table)
        .where(inArray(idColumn(table), [...ids]));

      return found.map((row) => String(row.id));
    },

    update: async (table, id, values) => {
      await db
        .update(table)
        .set(values)
        .where(eq(idColumn(table), id));
    },
  };
}
```

Seeds then look exactly like the Zod ones, with a table in place of a schema and no `name` needed: the adapter names the seed after the table, in camelCase, so `week_number_systems` becomes `weekNumberSystems`.

### Kysely, Prisma, raw SQL

The same two pieces. For Kysely the target is a table name and the wrapper pins `Insertable<DB[T]>`:

```ts
export function defineSeed<
  T extends keyof DB & string,
  C extends SeedConfig,
  A extends object,
  X extends object = object,
>(definition: SeedDefinition<T, Insertable<DB[T]>, C, A, X>) {
  return define(definition);
}
```

The adapter is `db.insertInto(table).values(rows).onConflict((oc) => oc.doNothing())` and friends. Anything that can name a target, insert rows while ignoring existing ids, and update a row by id can be an adapter.

## The adapter contract

```ts
type Adapter<Target> = {
  // A stable name. It becomes the default seed name and part of every id.
  // Return undefined when the target has none; those seeds must set `name`.
  nameOf: (target: Target) => string | undefined;

  // Optional columns written beneath every row. Leave it out unless every
  // target has the columns: most drivers do not drop unknown keys.
  stamp?: (context: { id: string; now: Date }) => Record<string, unknown>;

  // Write rows, skipping any whose id already exists. Return how many were
  // written, or undefined if the driver cannot say.
  insert: (
    target: Target,
    rows: ReadonlyArray<Record<string, unknown>>,
  ) => Promise<number | undefined>;

  // Which of these ids exist. Only called when insert wrote fewer rows than
  // offered, to tell a harmless rerun from a row a unique constraint rejected.
  present?: (
    target: Target,
    ids: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<string>>;

  update: (
    target: Target,
    id: string,
    values: Record<string, unknown>,
  ) => Promise<void>;
};
```

`memoryAdapter()` ships in the box. It keeps rows in a `Map` keyed by target identity, names string targets after themselves, and takes an optional `parse` hook. Use it to generate object graphs with no database at all, or to unit test seeds without one. `rows(seed)` hands back what is stored against that seed's target, typed as the seed's rows and reflecting anything `link` set, which a handle's `all` does not.

## Faker and other extras

The toolkit every seed receives is deliberately small: `now`, `id`, and `random`. Anything richer comes in through `extend`, which runs once per run and is spread into every seed's arguments. That is where a faker instance belongs, seeded from the run so the stream starts fresh every time:

```ts
import { Faker, en } from "@faker-js/faker";

type WithFaker = { faker: Faker };

export function defineSeed<
  S extends z.ZodObject,
  C extends SeedConfig,
  A extends object,
>(definition: SeedDefinition<S, z.input<S>, C, A, WithFaker>) {
  return define(definition);
}

const people = defineSeed({
  target: personSchema,
  name: "people",
  build: ({ faker }) =>
    Array.from({ length: 10 }, () => ({ name: faker.person.fullName() })),
});

await seedOne(
  adapter,
  people,
  {},
  {
    extend: ({ seed }) => {
      const faker = new Faker({ locale: [en] });
      faker.seed(seed);
      return { faker };
    },
  },
);
```

The fifth type parameter says what a seed needs. A seed that needs `{ faker }` cannot be run without an `extend` that provides it, and cannot be pulled in by a seed that declares no extras. A seed that needs nothing can be pulled in from anywhere. The compiler enforces both.

Do not import a faker singleton at module level. Nothing would reseed it between runs, a dry run and its real run would diverge, and two runs in one process would interleave draws.

## Determinism

A run is reproducible when every value derives from the run's inputs. The rules:

- **Draw from `random`, or from something you seeded in `extend`.** Never from `Math.random`.
- **Derive dates from `now`.** Never from `new Date()`.
- **Await dependencies in order.** Random draws inside a `Promise.all` resolve in scheduler order. Get what you need, then draw.
- **Ids never depend on the random stream.** They come from the seed name and row index, so changing the seed changes values but not ids, and growing a list keeps the ids of the rows that were already there.

```ts
await seedOne(
  adapter,
  players,
  {},
  {
    seed: 42, // random stream
    now: new Date("2026-01-01T00:00:00Z"), // the anchor every date derives from
  },
);
```

Both default to fixed values, so a run with no options is reproducible too.

## Config

`defaults` declares every key a seed accepts. Callers override by seed name, wherever the seed sits in the tree:

```ts
await seedOne(adapter, players, {
  teams: { names: ["Gold"] },
  players: { perTeam: 1 },
});
```

Nested objects merge, so `{ ages: { max: 40 } }` keeps the default `min`. Arrays replace, because a partial weighting table means nothing. A key no seed declares is an error, and so is a top-level key no seed in the run claimed, so a typo cannot silently apply to nothing.

## Handles and accessors

Every seed resolves to a handle: the rows it wrote, a `first()` that throws rather than hand back an undefined that lands as a null foreign key, and whatever `accessors` defines on top:

```ts
const users = defineSeed({
  target: usersTable,
  build: /* ... */,
  accessors: ({ rows, random }) => ({
    forSite: (siteId: string) => rows.filter((user) => user.row.siteId === siteId),
    pickRandom: () => random.pick(rows),
  }),
});
```

Accessors are what dependents use to build foreign keys: `(await get(users)).forSite(site.id)`.

## Links

Two tables that point at each other cannot both be satisfied at insert time. A `link` runs once every seed in the run has inserted, and may call `get` on a seed that depends on this one without tripping the cycle guard:

```ts
const books = defineSeed({
  target: booksTable,
  build: async ({ get }) => /* one row per author */,
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
```

`update` writes to this seed's own rows and `updateIn` to another seed's. Write a reciprocal pair from one place: writing only the side you own leaves the other table disagreeing, and nothing in the database says otherwise. Links drain in waves, so a link may pull in a seed nothing had needed yet, and that seed may bring a link of its own.

## Dry runs

```ts
const foundation = { tenants, sites, roles, users };
const handles = await seedMany(adapter, foundation, {}, { dryRun: true });
```

Nothing is written, but the handles name exactly the rows a real run inserts. A test suite can take handles at module level for free and do the only actual seeding in `beforeEach`.

## Reports

```ts
await seedOne(
  adapter,
  players,
  {},
  {
    onSeed: ({ name, target, rows }) =>
      console.log(`${name} -> ${target}: ${rows} rows`),
  },
);
```

Fires for every seed the run wrote, deepest first. `rows` counts rows offered, not written: a rerun offers the same rows and the adapter keeps the ones already there.

## Namespaces and ids

Ids are UUID v5: a hash of the target name, the seed name and the row index, inside a namespace. Two seeds that write the same target from different worlds, a dev profile and an integration fixture say, must use different namespaces or they mint identical ids for unrelated rows:

```ts
export const INTEGRATION = "b41f0c8a-2d67-4e19-9a3c-5f8e7d206b14";

const tenants = defineSeed({
  target: tenantsTable,
  namespace: INTEGRATION /* ... */,
});
```

A namespace can also be set for a whole run through the `namespace` option. A row may bring its own `id`, and `toolkit.id(key)` derives extra ids for other columns. To change the format entirely, pass `id` in the run options and return whatever your primary keys look like.

The implementation ships its own SHA-1, forty lines that never change, so no crypto API and no `uuid` package are needed and the same identity yields the same id on every runtime. Ids match what the `uuid` package's `v5` produces.

## Running

| Function                                             | Use it when                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `seedOne(adapter, seed, config?, options?)`          | You want one leaf and everything beneath it, and its handle back.                           |
| `seedMany(adapter, { ...seeds }, config?, options?)` | You want several leaves seeded against one run, and their handles back under the same keys. |

```ts
const world = await seedMany(adapter, { publishers, authors, books }, config);

world.books.forAuthor(world.authors.first().id); // every handle keeps its accessors
```

Both share one run, so a seed that two leaves depend on is built once. A reusable set of seeds is just an object to spread: `seedMany(adapter, { ...foundation, mine })`. When a seed needs extras, `config` and `options` stop being optional.

## Stability

Ids and the random stream are part of the contract. A minor release will not change what a given seed, name, index and namespace derive to, nor what a given `seed` option draws.
