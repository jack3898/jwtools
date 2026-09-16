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
  /**
   * An id that is a pure function of `key` within this seed. Put it on the
   * row: the engine never reads it back, but a rerun then offers the same
   * rows, and a dry run's handles name the rows a real run inserts.
   */
  readonly id: (key: string) => string;
  /** A stream of this seed's own, derived from the run seed and the seed. */
  readonly random: Random;
};

export type Handle<Insert extends object, A extends object> = A & {
  /** Live: what a link sets through `update` shows here. */
  readonly all: ReadonlyArray<Insert>;
  /** Throws rather than hand back an undefined that lands as a null FK. */
  readonly first: () => Insert;
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
  /** Carried so `override` can be typed from it. */
  readonly defaults: C | undefined;
  /** This seed with overrides for its defaults, ready to plant. */
  readonly override: (
    config: Overrides<C>,
  ) => SeedEntry<Seed<Target, Insert, A, X, C>>;
  readonly resolve: (run: Run<X>) => Promise<Handle<Insert, A>>;
};

/**
 * A seed with the overrides for its defaults, from `override`. Planting a
 * bare seed is the same as planting it with none.
 */
export type SeedEntry<S> = {
  readonly seeder: S;
  /** Already typed by `override`; a key the seed does not declare never gets here. */
  readonly config: SeedConfig | undefined;
};

/** One seeding run. Created by the engine, never by hand. */
export type Run<X extends object> = {
  readonly nameOf: (seed: SeedMeta) => string;
  readonly toolkit: (seed: SeedMeta) => Toolkit & X;
  readonly stamp: (context: StampContext) => object;
  readonly insert: (
    seed: SeedMeta,
    rows: ReadonlyArray<object>,
  ) => Promise<void>;
  /** Sets columns on a row some seed in this run built. */
  readonly update: (row: object, values: object) => Promise<void>;
  /** The seed's defaults under its overrides, checked when planted. */
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
    readonly rows: ReadonlyArray<Insert>;
  };

export type LinkArgs<
  Insert extends object,
  C extends SeedConfig,
  X extends object,
> = BuildArgs<C, X> & {
  readonly rows: ReadonlyArray<Insert>;
  /**
   * Sets columns on a row from any handle in this run, this seed's own or
   * another's. A reciprocal pair has to be written from one place: writing
   * only the side you own leaves the other table disagreeing, and nothing in
   * the database says otherwise.
   */
  readonly update: <R extends object>(
    row: R,
    values: Partial<NoInfer<R>>,
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
   * unrelated rows.
   */
  readonly namespace?: string | undefined;
  /** Config `override` may change. Every key must be declared here. */
  readonly defaults?: C;
  readonly build: (
    args: BuildArgs<C, X>,
  ) => Promise<ReadonlyArray<Insert>> | ReadonlyArray<Insert>;
  /**
   * Named lookups over the rows this seed wrote, exposed on its handle next
   * to `all` and `first`, which win over accessors of the same name.
   */
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
export function seeder<
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
    override: (config) => ({ seeder: seed, config }),
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
    // it was planted, so what comes back has the defaults' shape.
    const args = { ...toolkit, config: run.configOf(seed) as C, get: run.get };
    const built = await definition.build(args);

    // These objects are the handle: a link's update lands on them, so a
    // dependent holding one sees it.
    const written: ReadonlyArray<Insert> = built.map((row) => ({
      ...run.stamp({ now: toolkit.now }),
      ...row,
    }));

    await run.insert(seed, written);

    const { link } = definition;

    if (link) {
      run.defer(() => link({ ...args, rows: written, update: run.update }));
    }

    // With no accessors defined, `A` is inferred as `object`, so `{}` is one.
    const accessors =
      definition.accessors?.({ ...toolkit, rows: written }) ?? ({} as A);

    return {
      ...accessors,
      all: written,
      first: (): Insert => {
        const [row] = written;

        if (!row) {
          throw new Error(`Seed "${name}" produced no rows`);
        }

        return row;
      },
    };
  }

  return seed;
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
