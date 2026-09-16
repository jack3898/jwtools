/** What the engine stamps on every row beneath the seed's own columns. */
export type StampContext = {
  readonly now: Date;
};

/**
 * Everything the engine needs from a storage layer. The engine never looks at
 * a target itself: it hands the target to these functions and to nothing else,
 * so a target can be a Drizzle table, a Kysely table name, a Zod schema, or
 * anything an adapter knows how to write to. Nor does it look inside a row
 * for its key: `key` is the one place that says what identifies a row.
 */
export type Adapter<Target> = {
  /**
   * A stable name for the target. It becomes the default seed name and part
   * of every derived id, so it must not change between runs. Return
   * `undefined` for targets that have no name; every seed on such a target
   * must then set `name` itself.
   */
  readonly nameOf: (target: Target) => string | undefined;
  /**
   * What identifies `row` in the target: the value under its primary key,
   * or a tuple for a composite one. It is what a rerun deduplicates by and
   * what `present` and `update` receive. Return `undefined` for a row that
   * has none, such as one whose key the database assigns; such a row is
   * inserted but cannot be updated.
   */
  readonly key: (target: Target, row: Record<string, unknown>) => unknown;
  /**
   * Columns written onto every row beneath the seed's own values. Drizzle
   * drops keys a table lacks, so a Drizzle adapter can stamp timestamps
   * freely. Most other drivers do not, so leave this out unless every target
   * has the columns.
   */
  readonly stamp?:
    | ((context: StampContext) => Record<string, unknown>)
    | undefined;
  /**
   * Write rows, ignoring any already there. That is what makes a rerun a
   * no-op: a builder's ids derive from identity, so a row already there is
   * the same row. Returns how many rows were actually written, or `undefined`
   * when the driver cannot say.
   */
  readonly insert: (
    target: Target,
    rows: ReadonlyArray<Record<string, unknown>>,
  ) => Promise<number | undefined>;
  /**
   * How many rows under these keys exist in the target. Called only when
   * `insert` reported fewer rows than it was offered, to tell a harmless
   * repeat from a row a unique constraint rejected.
   */
  readonly present?:
    | ((target: Target, keys: ReadonlyArray<unknown>) => Promise<number>)
    | undefined;
  /** Set columns on the row under this key. */
  readonly update: (
    target: Target,
    key: unknown,
    values: Record<string, unknown>,
  ) => Promise<void>;
};

/** Rows by key, by target. What `memory` writes into. */
export type MemoryStore<Target> = Map<
  Target,
  Map<string, Record<string, unknown>>
>;

export type MemoryOptions<Target> = {
  /**
   * Where rows go. Pass your own to look at what was written; the adapter
   * has no read API of its own, since rows come back through handles.
   */
  readonly store?: MemoryStore<Target>;
  /**
   * Runs on every row before it is stored and returns what to store. Hand it
   * a schema's `parse` to validate rows, or use it to apply defaults.
   */
  readonly parse?: (
    target: Target,
    row: Record<string, unknown>,
  ) => Record<string, unknown>;
  /**
   * What a row is stored under. Defaults to its `id`. A row with none is
   * stored regardless, but like a row under a serial key it is appended
   * again on a rerun.
   */
  readonly key?: (target: Target, row: Record<string, unknown>) => unknown;
};

/**
 * Keeps rows in memory, keyed by target identity. The zero-dependency default:
 * generate object graphs without a database, or test seeds without one. A
 * string target names itself; any other kind needs `name` on the seed.
 */
export function memory<Target = unknown>(
  options: MemoryOptions<Target> = {},
): Adapter<Target> {
  const store: MemoryStore<Target> = options.store ?? new Map();
  const key =
    options.key ?? ((_target: Target, row: Record<string, unknown>) => row.id);

  function tableFor(target: Target): Map<string, Record<string, unknown>> {
    const table =
      store.get(target) ?? new Map<string, Record<string, unknown>>();

    store.set(target, table);

    return table;
  }

  // The engine hands over private copies, so there is nothing to defend.
  const prepare =
    options.parse ?? ((_target: Target, row: Record<string, unknown>) => row);

  return {
    nameOf: (target) => (typeof target === "string" ? target : undefined),

    key,

    // No `present`: nothing here can reject a row, so the count is the truth.
    insert: (target, rows) => {
      const table = tableFor(target);
      let written = 0;

      for (const row of rows) {
        const found = key(target, row);
        const under = found == null ? `#${table.size}` : String(found);

        if (!table.has(under)) {
          table.set(under, prepare(target, row));
          written++;
        }
      }

      return Promise.resolve(written);
    },

    update: (target, found, values) => {
      const table = tableFor(target);
      const under = String(found);
      const existing = table.get(under);

      if (!existing) {
        throw new Error(`No row "${under}" to update`);
      }

      table.set(under, prepare(target, { ...existing, ...values }));

      return Promise.resolve();
    },
  };
}
