export type StampContext = {
  readonly now: Date;
};

/**
 * The engine hands a target to these and looks at nothing else, so a target
 * can be anything an adapter knows how to write to.
 */
export type Adapter<Target> = {
  /**
   * A stable name: the default seed name and part of every id. `undefined`
   * means every seed on the target must set `name`.
   */
  readonly nameOf: (target: Target) => string | undefined;
  /**
   * What identifies `row` in the target, or `undefined` for a row that has no
   * key yet. A rerun deduplicates by it; `present` and `update` receive it.
   */
  readonly key: (target: Target, row: Record<string, unknown>) => unknown;
  /** Columns beneath every row. Leave it out unless every target has them. */
  readonly stamp?:
    | ((context: StampContext) => Record<string, unknown>)
    | undefined;
  /**
   * Write rows, ignoring any already there. Returns how many were written,
   * or `undefined` when the driver cannot say.
   */
  readonly insert: (
    target: Target,
    rows: ReadonlyArray<Record<string, unknown>>,
  ) => Promise<number | undefined>;
  /** How many rows under these keys exist. Called when `insert` came up short. */
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

export type MemoryStore<Target> = Map<
  Target,
  Map<string, Record<string, unknown>>
>;

export type MemoryOptions<Target> = {
  /** Pass your own to look at what was written; there is no read API. */
  readonly store?: MemoryStore<Target>;
  /** Runs on every row before it is stored. Hand it a schema's `parse`. */
  readonly parse?: (
    target: Target,
    row: Record<string, unknown>,
  ) => Record<string, unknown>;
  /** What a row is stored under, `id` by default. A row with none is appended. */
  readonly key?: (target: Target, row: Record<string, unknown>) => unknown;
};

/** A string target names itself; any other kind needs `name` on the seed. */
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
