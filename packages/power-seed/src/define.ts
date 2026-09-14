import type { StampContext } from "./adapter";
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
  /** A stream of this seed's own, derived from the run seed and the seed. */
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
export type Get<X extends object> = <Insert extends object, A extends object>(
  seed: Seed<unknown, Insert, A, X>,
) => Promise<Handle<Insert, A>>;

/** The parts of a seed the engine reads without knowing its types. */
export type SeedMeta = {
  readonly name: string | undefined;
  readonly target: unknown;
  readonly namespace: string | undefined;
  readonly defaults: SeedConfig | undefined;
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
  readonly resolve: (run: Run<X>) => Promise<Handle<Insert, A>>;
};

/** One seeding run. Created by the engine, never by hand. */
export type Run<X extends object> = {
  readonly nameOf: (seed: SeedMeta) => string;
  readonly toolkit: (seed: SeedMeta) => Toolkit & X;
  readonly stamp: (context: StampContext) => object;
  readonly insert: (
    seed: SeedMeta,
    rows: ReadonlyArray<Row<object>>,
  ) => Promise<void>;
  readonly update: (
    seed: SeedMeta,
    id: string,
    values: object,
  ) => Promise<void>;
  /** The seed's defaults under its entry's overrides, checked when listed. */
  readonly configOf: (seed: SeedMeta) => SeedConfig;
  /** Resolves a seed once per run, and refuses one that is still building. */
  readonly get: Get<X>;
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
> = BuildArgs<C, X> & {
  readonly rows: ReadonlyArray<Row<Insert>>;
  /** Sets columns on one of this seed's own rows. */
  readonly update: (id: string, values: Partial<Insert>) => Promise<void>;
  /**
   * Sets columns on a row belonging to another seed. A reciprocal pair has to
   * be written from one place: writing only the side you own leaves the
   * other table disagreeing, and nothing in the database says otherwise.
   */
  readonly updateIn: <OtherInsert extends object, OtherA extends object>(
    seed: Seed<unknown, OtherInsert, OtherA, X>,
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
  readonly name?: string | undefined;
  /**
   * Ids derive within this namespace. Two seeds writing the same target from
   * different worlds must set different ones, or they mint identical ids for
   * unrelated rows and the run refuses the second.
   */
  readonly namespace?: string | undefined;
  /** Config an entry may override. Every key must be declared here. */
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

  const seed: Seed<Target, Insert, A, X, C> = {
    name: definition.name,
    target: definition.target,
    namespace: definition.namespace,
    defaults: definition.defaults,
    resolve: (run) => {
      const cached = cache.get(run);

      if (cached) {
        return cached;
      }

      const pending = build(run);

      cache.set(run, pending);

      return pending;
    },
  };

  async function build(run: Run<X>): Promise<Handle<Insert, A>> {
    const name = run.nameOf(seed);
    const toolkit = run.toolkit(seed);
    // The run checked and merged this seed's config against its defaults when
    // it was listed, so what comes back has the defaults' shape.
    const args = { ...toolkit, config: run.configOf(seed) as C, get: run.get };
    const built = await definition.build(args);

    const written = built.map((row, index) => {
      const id = ownId(row) ?? toolkit.id(`${name}#${index}`);

      return {
        id,
        row: { id, ...run.stamp({ id, now: toolkit.now }), ...row },
      };
    });

    await run.insert(seed, written);

    const { link } = definition;

    if (link) {
      run.defer(() =>
        link({
          ...args,
          rows: written,
          update: (id, values) => run.update(seed, id, values),
          updateIn: (other, id, values) => run.update(other, id, values),
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

  return seed;
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
