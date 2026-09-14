import type { Random } from "./random";

export type SeedConfig = Record<string, unknown>;

/**
 * What every seed function is handed. Reaching past these for `Math.random`
 * or the real clock breaks a rerun.
 */
export type Toolkit = {
  /** The run's anchor instant. Every generated date should derive from it. */
  readonly now: Date;
  /** An id that is a pure function of `key` within this seed's target. */
  readonly id: (key: string) => string;
  /** A stream seeded once per run. */
  readonly random: Random;
};

export type Row<Insert extends object> = {
  readonly id: string;
  readonly row: Insert;
};

export type Handle<Insert extends object, A extends object> = A & {
  /** Live: what a link sets through `update` or `updateIn` shows here. */
  readonly all: ReadonlyArray<Row<Insert>>;
  /** Throws rather than hand back an undefined that lands as a null FK. */
  readonly first: () => Row<Insert>;
};

/**
 * Asks for another seed. What a builder calls `get()` on IS its dependency,
 * so there is no separate list to keep in sync.
 */
export type Get<X extends object> = <
  Target,
  Insert extends object,
  A extends object,
>(
  seed: Seed<Target, Insert, A, X>,
) => Promise<Handle<Insert, A>>;

/** The parts of a seed the engine reads without knowing its types. */
export type SeedMeta = {
  readonly name: string | undefined;
  readonly target: unknown;
  readonly namespace: string | undefined;
};

/**
 * A defined seed. `X` is what the seed expects `extend` to provide on top of
 * the toolkit, so a seed that needs nothing can be pulled into any run and a
 * seed that needs `{ faker }` can only run where that is supplied.
 */
export type Seed<
  Target,
  Insert extends object,
  A extends object,
  X extends object = object,
  C extends SeedConfig = SeedConfig,
> = {
  readonly name: string | undefined;
  readonly target: Target;
  readonly namespace: string | undefined;
  /** Carried so an entry's `config` can be typed from its seeder. */
  readonly defaults: C | undefined;
  readonly resolve: (
    run: Run<X>,
    config: SeedConfig,
  ) => Promise<Handle<Insert, A>>;
};

/** One seeding run. Created by the engine, never by hand. */
export type Run<X extends object> = {
  readonly nameOf: (seed: SeedMeta) => string;
  readonly toolkit: (seed: SeedMeta) => Toolkit & X;
  readonly stamp: (context: { id: string; now: Date }) => object;
  readonly insert: (
    seed: SeedMeta,
    name: string,
    rows: ReadonlyArray<{ id: string; values: object }>,
  ) => Promise<void>;
  readonly update: (
    target: unknown,
    id: string,
    values: object,
  ) => Promise<void>;
  readonly configFor: (parent: SeedConfig, name: string) => SeedConfig;
  readonly get: (config: SeedConfig) => Get<X>;
  readonly enter: (name: string) => void;
  readonly leave: () => void;
  /** Queues a link to run once every seed in this run has inserted. */
  readonly defer: (link: () => Promise<void>) => void;
  readonly runLinks: () => Promise<void>;
};

export type BuildArgs<C extends SeedConfig, X extends object> = Toolkit &
  X & {
    readonly config: C;
    readonly get: Get<X>;
  };

export type AccessorArgs<Insert extends object, X extends object> = Toolkit &
  X & {
    readonly rows: ReadonlyArray<Row<Insert>>;
  };

export type LinkArgs<
  Insert extends object,
  C extends SeedConfig,
  X extends object,
> = Toolkit &
  X & {
    readonly config: C;
    readonly get: Get<X>;
    readonly rows: ReadonlyArray<Row<Insert>>;
    /** Sets columns on one of this seed's own rows. */
    readonly update: (id: string, values: Partial<Insert>) => Promise<void>;
    /**
     * Sets columns on a row belonging to another seed. A reciprocal pair has to
     * be written from one place: writing only the side you own leaves the
     * other table disagreeing, and nothing in the database says otherwise.
     */
    readonly updateIn: <
      OtherTarget,
      OtherInsert extends object,
      OtherA extends object,
    >(
      seed: Seed<OtherTarget, OtherInsert, OtherA, X>,
      id: string,
      values: Partial<OtherInsert>,
    ) => Promise<void>;
  };

export type SeedDefinition<
  Target,
  Insert extends object,
  C extends SeedConfig,
  A extends object,
  X extends object = object,
> = {
  /** Whatever the adapter writes to: a table, a table name, a schema. */
  readonly target: Target;
  /**
   * Defaults to the camelCase of the adapter's name for the target. Set it to
   * put two seeds on one target, or when the adapter cannot name the target.
   */
  readonly name?: string;
  /**
   * Ids derive within this namespace. Two seeds writing the same target from
   * different worlds must set different ones, or they mint identical ids for
   * unrelated rows and whichever runs second is silently dropped by the
   * adapter's conflict handling while its handle still vouches for the row.
   */
  readonly namespace?: string;
  /** Config the caller may override by seed name. Every key must be declared here. */
  readonly defaults?: C;
  readonly build: (
    args: BuildArgs<C, X>,
  ) => Promise<ReadonlyArray<Insert>> | ReadonlyArray<Insert>;
  /** Named lookups over the rows this seed wrote, exposed on its handle. */
  readonly accessors?: (args: AccessorArgs<Insert, X>) => A;
  /**
   * Fills columns that could not be set at insert time because the target
   * they point at points back. Runs once every seed in the run has inserted,
   * so `get` here may ask for a seed that asks for this one without tripping
   * the cycle guard.
   */
  readonly link?: (args: LinkArgs<Insert, C, X>) => Promise<void>;
};

/**
 * Seeds form a tree by asking for each other: what a builder calls `get()` on
 * IS its dependency, so there is no separate list to keep in sync.
 */
export function defineSeed<
  Target,
  Insert extends object,
  C extends SeedConfig,
  A extends object,
  X extends object = object,
>(
  definition: SeedDefinition<Target, Insert, C, A, X>,
): Seed<Target, Insert, A, X, C> {
  // Inside the closure, so it already knows this seed's types and the engine
  // needs no assertion to read them back.
  const cache = new WeakMap<Run<X>, Promise<Handle<Insert, A>>>();

  const seed = {
    name: definition.name,
    target: definition.target,
    namespace: definition.namespace,
    defaults: definition.defaults,
    resolve: (run: Run<X>, config: SeedConfig): Promise<Handle<Insert, A>> => {
      const cached = cache.get(run);

      if (cached) {
        return cached;
      }

      const pending = build(definition, run, config);

      cache.set(run, pending);

      return pending;
    },
  };

  return seed;
}

async function build<
  Target,
  Insert extends object,
  C extends SeedConfig,
  A extends object,
  X extends object,
>(
  definition: SeedDefinition<Target, Insert, C, A, X>,
  run: Run<X>,
  config: SeedConfig,
): Promise<Handle<Insert, A>> {
  const meta: SeedMeta = {
    name: definition.name,
    target: definition.target,
    namespace: definition.namespace,
  };
  const name = run.nameOf(meta);
  const toolkit = run.toolkit(meta);
  // Keyed by name from the root, never by position: a seed is built once and
  // shared, so it cannot take different config down different paths.
  const provided = run.configFor(config, name);

  const merged = resolveConfig(name, definition.defaults, provided);

  run.enter(name);

  const built = await definition.build({
    ...toolkit,
    config: merged,
    get: run.get(config),
  });

  run.leave();

  const written = built.map((row, index) => {
    const id = ownId(row) ?? toolkit.id(`${name}#${index}`);

    return {
      id,
      row: { id, ...run.stamp({ id, now: toolkit.now }), ...row },
    };
  });

  await run.insert(
    meta,
    name,
    written.map(({ id, row }) => ({ id, values: row })),
  );

  const { link } = definition;

  if (link) {
    run.defer(() =>
      link({
        ...toolkit,
        config: merged,
        get: run.get(config),
        rows: written,
        update: (id, values) => run.update(definition.target, id, values),
        updateIn: (other, id, values) => run.update(other.target, id, values),
      }),
    );
  }

  return Object.assign(
    {},
    definition.accessors?.({ ...toolkit, rows: written }),
    {
      all: written,
      first: (): Row<Insert> => {
        const [row] = written;

        if (!row) {
          throw new Error(`Seed "${name}" produced no rows`);
        }

        return row;
      },
    },
  );
}

/** A row may bring its own id; the derived one is the fallback. */
function ownId(row: object): string | undefined {
  if (!("id" in row)) {
    return undefined;
  }

  const { id } = row;

  return id === undefined || id === null ? undefined : String(id);
}

export type HandleOf<S> =
  S extends Seed<unknown, infer Insert, infer A, never>
    ? Handle<Insert, A>
    : never;

/**
 * Every key optional, nested plain objects included, because nested objects
 * merge. Arrays are left whole, because they replace.
 */
export type Overrides<C> = {
  readonly [K in keyof C]?: C[K] extends
    | ReadonlyArray<unknown>
    | ((...args: never) => unknown)
    ? C[K]
    : C[K] extends object
      ? Overrides<C[K]>
      : C[K];
};

/** A seed's config, from its own defaults, with every key optional. */
export type ConfigOf<S> =
  S extends Seed<unknown, object, object, never, infer C>
    ? Overrides<C>
    : never;

/**
 * The engine carries config as an untyped record; `ConfigOf` types it for the
 * caller. This is the one seam that hands the seed back its own `C`: the key
 * check is what makes the cast true, so they live together. Without the
 * check, a misspelt key would read as a silent request for the default.
 */
function resolveConfig<C extends SeedConfig>(
  name: string,
  defaults: C | undefined,
  provided: SeedConfig,
): C {
  const claimed: SeedConfig = defaults ?? {};
  const unknown = Object.keys(provided).filter((key) => !(key in claimed));

  if (unknown.length > 0) {
    throw new Error(
      `Seed "${name}" has no config named: ${unknown.join(", ")}. Accepts: ${Object.keys(claimed).sort().join(", ")}`,
    );
  }

  return deepMerge(claimed, provided) as C;
}

function isPlainObject(value: unknown): value is SeedConfig {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Nested objects merge, so `{ managers: { min: 2 } }` keeps the default `max`
 * instead of dropping it. Arrays replace: a partial weighting table means
 * nothing.
 */
function deepMerge(defaults: SeedConfig, overrides: SeedConfig): SeedConfig {
  const merged: SeedConfig = { ...defaults };

  for (const [key, value] of Object.entries(overrides)) {
    const existing = defaults[key];

    merged[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? deepMerge(existing, value)
        : value;
  }

  return merged;
}
