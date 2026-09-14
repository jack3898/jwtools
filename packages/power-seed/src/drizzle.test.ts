import { PGlite } from "@electric-sql/pglite";
import {
  eq,
  getTableColumns,
  getTableName,
  type InferInsertModel,
  inArray,
} from "drizzle-orm";
import {
  type PgDatabase,
  type PgQueryResultHKT,
  type PgTable,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { engineSuite, harnessSeeds } from "./engine.suite";
import {
  type Adapter,
  seeder as define,
  plant,
  type SeedConfig,
  type SeedDefinition,
} from "./index";

/** The README's Drizzle block, verbatim: pins the row type to the table. */
function seeder<
  T extends PgTable,
  C extends SeedConfig,
  A extends object,
  X extends object = object,
>(definition: SeedDefinition<T, InferInsertModel<T>, C, A, X>) {
  return define(definition);
}

/** The README's Drizzle adapter, verbatim. */
function drizzleAdapter(db: PgDatabase<PgQueryResultHKT>): Adapter<PgTable> {
  const BATCH = 1000;

  function idColumn(table: PgTable) {
    const column = getTableColumns(table).id;

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

const authorsTable = pgTable("authors", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  favouriteBookId: uuid("favourite_book_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

const booksTable = pgTable("books", {
  id: uuid().primaryKey().defaultRandom(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => authorsTable.id),
  title: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

const profilesTable = pgTable("profiles", {
  id: uuid().primaryKey().defaultRandom(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => authorsTable.id),
  bio: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

const DDL = `
  CREATE TABLE authors (
    id uuid PRIMARY KEY,
    name text NOT NULL UNIQUE,
    favourite_book_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE books (
    id uuid PRIMARY KEY,
    author_id uuid NOT NULL REFERENCES authors(id),
    title text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE profiles (
    id uuid PRIMARY KEY,
    author_id uuid NOT NULL REFERENCES authors(id),
    bio text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE authors
    ADD FOREIGN KEY (favourite_book_id) REFERENCES books(id);
`;

const pglite = new PGlite();
const db = drizzle(pglite);
const adapter = drizzleAdapter(db);

const { authors, books, profiles } = harnessSeeds<PgTable>({
  authors: authorsTable,
  books: booksTable,
  profiles: profilesTable,
});

beforeAll(async () => {
  await pglite.exec(DDL);
});

engineSuite("drizzle tables in pglite", {
  adapter,
  authors,
  books,
  profiles,
  rows: async ({ target: table }) => {
    const column = getTableColumns(table).id;

    if (!column) {
      throw new Error("no id column");
    }

    return db.select().from(table).orderBy(column);
  },
  reset: async () => {
    await pglite.exec("TRUNCATE authors, books, profiles CASCADE");
  },
});

describe("drizzle specifics", () => {
  it("names seeds after their table in camelCase", async () => {
    const reports: Array<string> = [];

    await plant(adapter, [profiles], {
      onSeed: (report) => reports.push(`${report.name}:${report.target}`),
    });

    expect(reports).toEqual(["authors:authors", "profiles:profiles"]);
  });

  it("refuses rows a unique constraint silently dropped", async () => {
    const duplicates = seeder({
      target: authorsTable,
      name: "duplicates",
      build: () => [{ name: "Twin" }, { name: "Twin" }],
    });

    await expect(plant(adapter, [duplicates])).rejects.toThrow(
      'Seed "duplicates" offered 2 rows to authors but 1 are not in it',
    );
  });
});
