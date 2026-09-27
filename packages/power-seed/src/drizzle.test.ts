import { PGlite } from "@electric-sql/pglite";
import { getTableColumns } from "drizzle-orm";
import {
  type PgTable,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { drizzleAdapter, seed } from "./drizzle";
import { engineSuite, harnessSeeds } from "./engine.suite";
import { plant } from "./index";

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

    await plant(
      { into: adapter, seeds: [profiles] },
      {
        onSeed: (report) => reports.push(`${report.name}:${report.target}`),
      },
    );

    expect(reports).toEqual(["authors:authors", "profiles:profiles"]);
  });

  it("refuses rows a unique constraint silently dropped", async () => {
    const duplicates = seed({
      target: authorsTable,
      name: "duplicates",
      build: ({ id }) => [
        { id: id("1"), name: "Twin" },
        { id: id("2"), name: "Twin" },
      ],
    });

    await expect(plant({ into: adapter, seeds: [duplicates] })).rejects.toThrow(
      'Seed "duplicates" offered 2 rows to authors but 1 are not in it',
    );
  });
});
