import type { Adapter } from "./adapter";
import type {
  ConfigOf,
  HandleOf,
  Run,
  Seed,
  SeedConfig,
  SeedMeta,
  Toolkit,
} from "./define";
import { createRandom } from "./random";
import { sha1, utf8, uuidV5 } from "./uuid";

export const FIXED_SEED = 20_260_703;

/** Every generated date derives from this, so a run never reads the clock. */
export const FIXED_NOW = new Date(Date.UTC(2026, 0, 1));

/** Ids are a pure function of identity, so a row keeps its id as data grows. */
export const DEFAULT_NAMESPACE = "6f9b2d5e-1c3a-4b7e-8f21-2a9c4d6e8b0f";

export type SeedReport = {
  readonly name: string;
  readonly target: string;
  /** Rows offered, not written: a repeat run keeps the ones already there. */
  readonly rows: number;
};

export type ExtendContext = {
  /**
   * Derived for this seed from the run seed and the seed's identity, so a
   * stream seeded from it is independent of every other seed's.
   */
  readonly seed: number;
  readonly now: Date;
};

export type IdContext = {
  readonly target: string;
  readonly key: string;
  readonly namespace: string;
};

type BaseRunOptions<X extends object> = {
  /** Seeds every stream in the run. Same seed, same rows. */
  readonly seed?: number | undefined;
  readonly now?: Date | undefined;
  readonly namespace?: string | undefined;
  readonly onSeed?: ((report: SeedReport) => void) | undefined;
  /**
   * Compute handles without writing rows. Sound because building is pure:
   * ids and rows are functions of seed identity, never of the database, so a
   * dry run's handles name exactly the rows a real run inserts.
   */
  readonly dryRun?: boolean | undefined;
  /** Replaces uuid v5 as the id derivation. Must be pure. */
  readonly id?: ((context: IdContext) => string) | undefined;
  /**
   * Built once per seed and spread into its toolkit. Where a faker instance,
   * seeded from `context.seed`, comes in.
   */
  readonly extend?: ((context: ExtendContext) => X) | undefined;
};

/** `extend` is optional only when the seeds need nothing beyond the toolkit. */
type ExtendRequirement<X extends object> = object extends X
  ? unknown
  : { readonly extend: (context: ExtendContext) => X };

export type RunOptions<X extends object = object> = BaseRunOptions<X> &
  ExtendRequirement<X>;

/**
 * The trailing argument of `seed`. Optional until a seed needs extras, at
 * which point leaving it off would skip `extend` unnoticed.
 */
export type RunArgs<X extends object> = object extends X
  ? [options?: RunOptions<X>]
  : [options: RunOptions<X>];

/** `week_number_systems` -> `weekNumberSystems`, so config keys read naturally. */
function camelCase(value: string): string {
  return value.replaceAll(/_(\w)/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );
}

function createRun<Target, X extends object>(
  adapter: Adapter<Target>,
  options: BaseRunOptions<X>,
  configs: ReadonlyMap<object, SeedConfig>,
): Run<X> {
  const seed = options.seed ?? FIXED_SEED;
  const now = options.now ?? FIXED_NOW;
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const stack: Array<string> = [];
  const links: Array<() => Promise<void>> = [];
  /**
   * The row objects handles hold, by id, by target. A link's update lands on
   * these too, so a handle never goes stale. Kept in a dry run as well: the
   * handles it computes must match what a real run's would say.
   */
  const held = new Map<unknown, Map<string, object>>();

  // The engine carries targets as `unknown` so seeds on different concrete
  // targets can depend on each other. The adapter is the one place that
  // knows what they really are.
  const targetOf = (meta: SeedMeta): Target => meta.target as Target;

  function nameOf(meta: SeedMeta): string {
    if (meta.name !== undefined) {
      return meta.name;
    }

    const targetName = adapter.nameOf(targetOf(meta));

    if (targetName === undefined) {
      throw new Error(
        "A seed on a target the adapter cannot name must set `name`",
      );
    }

    return camelCase(targetName);
  }

  /** The raw target name goes into ids, so a rename of the seed keeps them. */
  function targetNameOf(meta: SeedMeta): string {
    return adapter.nameOf(targetOf(meta)) ?? nameOf(meta);
  }

  const run: Run<X> = {
    nameOf,

    // Each seed draws from its own stream, keyed the way ids are, so its
    // values survive reordering, new dependencies and other entry points.
    toolkit: (meta): Toolkit & X => {
      const target = targetNameOf(meta);
      const within = meta.namespace ?? namespace;
      const derive = options.id ?? defaultId;
      const own = streamSeed(seed, target, within);

      return Object.assign(
        {
          now,
          random: createRandom(own),
          id: (key: string) => derive({ target, key, namespace: within }),
        },
        options.extend?.({ seed: own, now }),
      );
    },

    stamp: (context) => adapter.stamp?.(context) ?? {},

    // Ignoring conflicts is what makes a run repeatable: ids derive from
    // identity, so a row already there is the same row.
    insert: async (meta, name, rows) => {
      const heldRows = held.get(meta.target) ?? new Map<string, object>();

      held.set(meta.target, heldRows);

      for (const { id, values } of rows) {
        // Same id, same row, is what makes a rerun safe. Within one run it
        // means two seeds minted the same id, and the adapter would keep the
        // first while the second's handle vouches for rows that never landed.
        if (heldRows.has(id)) {
          throw new Error(
            `Seed "${name}" minted id "${id}" for ${targetNameOf(meta)}, which this run already wrote. Two seeds on one target need different names or namespaces.`,
          );
        }

        heldRows.set(id, values);
      }

      if (options.dryRun) {
        return;
      }

      const target = targetOf(meta);
      const written = await adapter.insert(
        target,
        rows.map(({ values }) => ({ ...values })),
      );

      // A row can be skipped because it is already there, the same seed run
      // twice, or because a natural key rejected it, which the handle would
      // otherwise still vouch for. Only the second is a problem, so check the
      // ids rather than the count.
      if (written !== undefined && written < rows.length && adapter.present) {
        const offered = rows.map(({ id }) => id);
        const present = new Set(await adapter.present(target, offered));
        const missing = offered.filter((id) => !present.has(id));

        if (missing.length > 0) {
          throw new Error(
            `Seed "${name}" offered ${offered.length} rows to ${targetNameOf(meta)} but ${missing.length} are not in it. A unique constraint other than the primary key rejected them, so their handles would name rows that do not exist.`,
          );
        }
      }

      options.onSeed?.({ name, target: targetNameOf(meta), rows: rows.length });
    },

    update: async (target, id, values) => {
      if (!options.dryRun) {
        await adapter.update(target as Target, id, { ...values });
      }

      const row = held.get(target)?.get(id);

      if (row) {
        Object.assign(row, values);
      }
    },

    defer: (link) => {
      links.push(link);
    },

    // Drained in waves: a link may reach for a seed nothing had needed yet,
    // and that seed may bring a link of its own.
    runLinks: async () => {
      while (links.length > 0) {
        for (const link of links.splice(0)) {
          await link();
        }
      }
    },

    configOf: (seed) => configs.get(seed) ?? {},

    get: (dependency) => {
      const dependencyName = nameOf(dependency);

      if (stack.includes(dependencyName)) {
        throw new Error(
          `Seed dependency cycle: ${[...stack, dependencyName].join(" -> ")}`,
        );
      }

      return dependency.resolve(run);
    },

    enter: (name) => {
      stack.push(name);
    },

    leave: () => {
      stack.pop();
    },
  };

  return run;
}

function defaultId({ target, key, namespace }: IdContext): string {
  return uuidV5(`${target}:${key}`, namespace);
}

/**
 * The first four bytes of a SHA-1 over the same inputs ids use. Hashed
 * directly rather than through `uuidV5`, since a custom `id` may pair with
 * a namespace that is not a uuid.
 */
function streamSeed(seed: number, target: string, namespace: string): number {
  const [a = 0, b = 0, c = 0, d = 0] = sha1(
    utf8(`${seed}:${target}:${namespace}`),
  );

  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
}

/** One seed to run, with the overrides for its `defaults`. */
export type SeedEntry<S> = {
  readonly seeder: S;
  /** Typed from the seeder. A key it does not declare is an error. */
  readonly config?: ConfigOf<S> | undefined;
};

/** What `seed` resolves to: a handle for any seed that was listed. */
export type SeedResult<S extends ReadonlyArray<unknown>> = {
  readonly handle: <T extends S[number]>(seeder: T) => HandleOf<T>;
};

/**
 * Seed every entry, and everything each asks for, against one run. Entries
 * share what is beneath them, so a seed two of them depend on is built once.
 * A seed reached only through another is configured by listing it too.
 */
export async function seed<
  Target,
  const S extends ReadonlyArray<Seed<NoInfer<Target>, object, object, X>>,
  X extends object = object,
>(
  adapter: Adapter<Target>,
  entries: { readonly [K in keyof S]: SeedEntry<S[K]> },
  ...args: RunArgs<X>
): Promise<SeedResult<S>> {
  // The conditional keeps callers honest; by here both shapes are the same.
  const [options] = args as [BaseRunOptions<X>?];
  const configs = new Map<object, SeedConfig>();
  const shared = createRun(adapter, options ?? {}, configs);

  for (const entry of entries) {
    if (configs.has(entry.seeder)) {
      throw new Error(`Seed "${shared.nameOf(entry.seeder)}" is listed twice`);
    }

    configs.set(entry.seeder, entry.config ?? {});
  }

  const handles = new Map<object, unknown>();

  for (const entry of entries) {
    handles.set(entry.seeder, await entry.seeder.resolve(shared));
  }

  await shared.runLinks();

  return {
    handle: <T extends S[number]>(seeder: T) => {
      const handle = handles.get(seeder);

      if (handle === undefined) {
        throw new Error(`Seed "${shared.nameOf(seeder)}" was not listed`);
      }

      // Stored under the seed it came from, so it is that seed's handle.
      return handle as HandleOf<T>;
    },
  };
}
