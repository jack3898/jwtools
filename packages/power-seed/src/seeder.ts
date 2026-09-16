import type { StampContext } from "./adapter";
import type { Random } from "./random";

export type SeedConfig = Record<string, unknown>;

/** Reaching past these for `Math.random` or the real clock breaks a rerun. */
export type Toolkit = {
  /** The run's anchor instant. Every generated date should derive from it. */
  readonly now: Date;
  /**
   * A pure function of `key` within this seed. The engine never reads it
   * back.
   */
  readonly id: (key: string) => string;
  /** A stream of this seed's own. */
  readonly random: Random;
};

export type Handle<Insert extends object, A extends object> = A & {
  /** Live: what a link sets through `update` shows here. */
  readonly all: ReadonlyArray<Insert>;
  /** Throws rather than hand back an undefined that lands as a null FK. */
  readonly first: () => Insert;
};

export type Get<X extends object> = <Insert extends object, A extends object>(
  seed: Seed<unknown, Insert, A, X>,
) => Promise<Handle<Insert, A>>;

export type SeedMeta = {
  readonly name: string | undefined;
  readonly target: unknown;
  readonly namespace: string | undefined;
  readonly defaults: SeedConfig | undefined;
};

/**
 * `X` is what the seed expects `extend` to provide on top of the toolkit, so
 * a seed that needs `{ faker }` can only run where that is supplied.
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
  readonly defaults: C | undefined;
  readonly override: (
    config: Overrides<C>,
  ) => SeedEntry<Seed<Target, Insert, A, X, C>>;
  readonly resolve: (run: Run<X>) => Promise<Handle<Insert, A>>;
};

export type SeedEntry<S> = {
  readonly seeder: S;
  readonly config: SeedConfig | undefined;
};

export type Run<X extends object> = {
  readonly nameOf: (seed: SeedMeta) => string;
  readonly toolkit: (seed: SeedMeta) => Toolkit & X;
  readonly stamp: (context: StampContext) => object;
  readonly insert: (
    seed: SeedMeta,
    rows: ReadonlyArray<object>,
  ) => Promise<void>;
  readonly update: (row: object, values: object) => Promise<void>;
  readonly configOf: (seed: SeedMeta) => SeedConfig;
  readonly get: Get<X>;
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
  /** Sets columns on a row from any handle in this run, this seed's or not. */
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
  readonly target: Target;
  /** Defaults to the camelCase of the adapter's name for the target. */
  readonly name?: string | undefined;
  /** Ids derive within this namespace. */
  readonly namespace?: string | undefined;
  /** Every key `override` may change must be declared here. */
  readonly defaults?: C;
  readonly build: (
    args: BuildArgs<C, X>,
  ) => Promise<ReadonlyArray<Insert>> | ReadonlyArray<Insert>;
  /** Named lookups over this seed's rows, on its handle beside `all`. */
  readonly accessors?: (args: AccessorArgs<Insert, X>) => A;
  /**
   * Runs once every seed in the run has inserted, so `get` here may ask for
   * a seed that asks for this one without tripping the cycle guard.
   */
  readonly link?: (args: LinkArgs<Insert, C, X>) => Promise<void>;
};

/** What a builder calls `get()` on IS its dependency; there is no list. */
export function seeder<
  Target,
  Insert extends object,
  C extends SeedConfig,
  A extends object,
  X extends object = object,
>(
  definition: SeedDefinition<Target, Insert, C, A, X>,
): Seed<Target, Insert, A, X, C> {
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
    // Checked against the defaults when planted, so the cast holds.
    const args = { ...toolkit, config: run.configOf(seed) as C, get: run.get };
    const built = await definition.build(args);

    // A link's update lands on these, so a dependent holding one sees it.
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

export type ConfigOf<S> =
  S extends Seed<unknown, object, object, never, infer C>
    ? Overrides<C>
    : never;
