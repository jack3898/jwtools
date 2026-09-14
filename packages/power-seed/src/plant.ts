import type { Adapter } from "./adapter";
import { sha1, utf8, uuidV5 } from "./crypto";
import { createRandom } from "./random";
import type {
  HandleOf,
  Run,
  Seed,
  SeedConfig,
  SeedEntry,
  SeedMeta,
  Toolkit,
} from "./seeder";

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

/**
 * The trailing argument of `seed`. Optional until a seed needs extras, at
 * which point leaving it off would skip `extend` unnoticed.
 */
export type RunArgs<X extends object> = object extends X
  ? [options?: BaseRunOptions<X>]
  : [
      options: BaseRunOptions<X> & {
        readonly extend: (context: ExtendContext) => X;
      },
    ];

export type RunOptions<X extends object = object> = NonNullable<RunArgs<X>[0]>;

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

  /**
   * The target half of an id is the adapter's name for the target, not the
   * seed's, so two seeds on one target share it and differ only by key.
   */
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
    insert: async (meta, rows) => {
      const name = nameOf(meta);
      const targetName = targetNameOf(meta);
      const heldRows = held.get(meta.target) ?? new Map<string, object>();

      held.set(meta.target, heldRows);

      for (const { id, row } of rows) {
        // Same id, same row, is what makes a rerun safe. Within one run it
        // means two seeds minted the same id, and the adapter would keep the
        // first while the second's handle vouches for rows that never landed.
        if (heldRows.has(id)) {
          throw new Error(
            `Seed "${name}" minted id "${id}" for ${targetName}, which this run already wrote. Two seeds on one target need different names or namespaces.`,
          );
        }

        heldRows.set(id, row);
      }

      if (options.dryRun) {
        return;
      }

      const target = targetOf(meta);
      const written = await adapter.insert(
        target,
        rows.map(({ row }) => ({ ...row })),
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
            `Seed "${name}" offered ${offered.length} rows to ${targetName} but ${missing.length} are not in it. A unique constraint other than the primary key rejected them, so their handles would name rows that do not exist.`,
          );
        }
      }

      options.onSeed?.({ name, target: targetName, rows: rows.length });
    },

    update: async (meta, id, values) => {
      if (!options.dryRun) {
        await adapter.update(targetOf(meta), id, { ...values });
      }

      const row = held.get(meta.target)?.get(id);

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

    configOf: (meta) => configs.get(meta) ?? meta.defaults ?? {},

    // A seed that asks for one still on the stack, itself included, is a
    // cycle. Links run with an empty stack, so they may ask for anything.
    get: async (dependency) => {
      const name = nameOf(dependency);

      if (stack.includes(name)) {
        throw new Error(
          `Seed dependency cycle: ${[...stack, name].join(" -> ")}`,
        );
      }

      stack.push(name);

      try {
        return await dependency.resolve(run);
      } finally {
        stack.pop();
      }
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
  const digest = sha1(utf8(`${seed}:${target}:${namespace}`));

  return new DataView(digest.buffer, digest.byteOffset).getUint32(0);
}

/**
 * The engine carries config as an untyped record; `ConfigOf` types it for the
 * caller and `build` reads it back as the defaults' shape. The key check is
 * what makes that true. Without it a misspelt key would read as a silent
 * request for the default.
 */
function resolveConfig(
  name: string,
  defaults: SeedConfig | undefined,
  provided: SeedConfig,
): SeedConfig {
  const claimed = defaults ?? {};
  const unknown = Object.keys(provided).filter((key) => !(key in claimed));

  if (unknown.length > 0) {
    throw new Error(
      `Seed "${name}" has no config named: ${unknown.join(", ")}. Accepts: ${Object.keys(claimed).sort().join(", ")}`,
    );
  }

  return deepMerge(claimed, provided);
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

/** What may go in the ground: a seed as is, or one with overrides. */
type Plantable<Target, X extends object> =
  | Seed<Target, object, object, X>
  | SeedEntry<Seed<Target, object, object, X>>;

/** The seed behind a planting, whether it went in bare or with overrides. */
export type Planted<P> = P extends SeedEntry<infer S> ? S : P;

/** What `plant` grows: a handle for any seed that was planted. */
export type Bed<P extends ReadonlyArray<unknown>> = {
  readonly handle: <T extends Planted<P[number]>>(seeder: T) => HandleOf<T>;
};

/**
 * Plant every seed, and everything each asks for, in one bed. Seeds share
 * what is beneath them, so a seed two of them depend on is built once. A
 * seed reached only through another is configured by planting it too.
 */
export async function plant<
  Target,
  P extends ReadonlyArray<Plantable<NoInfer<Target>, X>>,
  X extends object = object,
>(
  adapter: Adapter<Target>,
  plantings: P,
  ...args: RunArgs<X>
): Promise<Bed<P>> {
  const [options] = args;
  const configs = new Map<object, SeedConfig>();
  const shared = createRun(adapter, options ?? {}, configs);
  // Read through the constraint, so a bare seed and an override tell apart.
  const list: ReadonlyArray<Plantable<Target, X>> = plantings;
  const seeders: Array<Seed<Target, object, object, X>> = [];

  // Every planting mistake is caught here, before anything is inserted.
  for (const planting of list) {
    const { seeder, config } =
      "seeder" in planting ? planting : { seeder: planting, config: undefined };
    const name = shared.nameOf(seeder);

    if (configs.has(seeder)) {
      throw new Error(`Seed "${name}" is planted twice`);
    }

    configs.set(seeder, resolveConfig(name, seeder.defaults, config ?? {}));
    seeders.push(seeder);
  }

  const handles = new Map<object, unknown>();

  for (const seeder of seeders) {
    handles.set(seeder, await shared.get(seeder));
  }

  await shared.runLinks();

  return {
    handle: <T extends Planted<P[number]>>(seeder: T) => {
      const handle = handles.get(seeder);

      if (handle === undefined) {
        throw new Error(`Seed "${shared.nameOf(seeder)}" was not planted`);
      }

      // Stored under the seed it came from, so it is that seed's handle.
      return handle as HandleOf<T>;
    },
  };
}
