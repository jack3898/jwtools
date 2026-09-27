/**
 * Drizzle in the box. `seed` types rows as the table's insert model for any
 * dialect; `drizzleAdapter` writes through a Postgres database.
 */
import {
  eq,
  getTableColumns,
  getTableName,
  type InferInsertModel,
  inArray,
  type Table,
} from "drizzle-orm";
import type {
  PgDatabase,
  PgQueryResultHKT,
  PgTable,
} from "drizzle-orm/pg-core";
import type { Adapter } from "./adapter";
import { seed as define, type SeedConfig, type SeedDefinition } from "./seeder";

/** Rows are the table's insert model. The seed is named after the table. */
export function seed<T extends Table, C extends SeedConfig, A extends object>(
  definition: SeedDefinition<T, InferInsertModel<T>, C, A>,
) {
  return define(definition);
}

/** `seed` for seeds that need extras: `X` is what `extend` must supply. */
export function seedWith<X extends object>() {
  return <T extends Table, C extends SeedConfig, A extends object>(
    definition: SeedDefinition<T, InferInsertModel<T>, C, A, X>,
  ) => define(definition);
}

const BATCH = 1000;

/** The table's primary key, as the row's property and the column. */
function primaryKey(table: PgTable) {
  const found = Object.entries(getTableColumns(table)).find(
    ([, column]) => column.primary,
  );

  if (!found) {
    throw new Error(`${getTableName(table)} has no primary key column`);
  }

  return found;
}

/**
 * Postgres through Drizzle. Each table's primary key is read from its
 * columns, so any key column works, uuid or serial, whatever it is called.
 */
export function drizzleAdapter(
  db: PgDatabase<PgQueryResultHKT>,
): Adapter<PgTable> {
  return {
    nameOf: (table) => getTableName(table),

    key: (table, row) => row[primaryKey(table)[0]],

    // Drizzle drops keys a table lacks, so tables without timestamps are fine.
    stamp: ({ now }) => ({ createdAt: now, updatedAt: now }),

    insert: async (table, rows) => {
      let written = 0;

      for (let start = 0; start < rows.length; start += BATCH) {
        const inserted = await db
          .insert(table)
          .values([...rows.slice(start, start + BATCH)])
          .onConflictDoNothing()
          .returning({ key: primaryKey(table)[1] });

        written += inserted.length;
      }

      return written;
    },

    present: async (table, keys) => {
      const column = primaryKey(table)[1];
      const found = await db
        .select({ key: column })
        .from(table)
        .where(inArray(column, [...keys]));

      return found.length;
    },

    update: async (table, key, values) => {
      await db
        .update(table)
        .set(values)
        .where(eq(primaryKey(table)[1], key));
    },
  };
}
