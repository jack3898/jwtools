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

export const FIXED_NOW = new Date(Date.UTC(2026, 0, 1));

export const DEFAULT_NAMESPACE = "6f9b2d5e-1c3a-4b7e-8f21-2a9c4d6e8b0f";

export type SeedReport = {
  readonly name: string;
  readonly target: string;
  /** Rows offered, not written: a repeat run keeps the ones already there. */
  readonly rows: number;
};

export type ExtendContext = {
  /** Derived for this seed, so a stream seeded from it is its own. */
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
  /** Compute handles without writing. Sound because building never reads. */
  readonly dryRun?: boolean | undefined;
  /** Replaces uuid v5 as the id derivation. Must be pure. */
  readonly id?: ((context: IdContext) => string) | undefined;
  /** Built once per seed and spread into its toolkit. */
  readonly extend?: ((context: ExtendContext) => X) | undefined;
};

/** Optional until a seed needs extras, so a missing `extend` is noticed. */
export type RunArgs<X extends object> = object extends X
  ? [options?: BaseRunOptions<X>]
  : [
      options: BaseRunOptions<X> & {
        readonly extend: (context: ExtendContext) => X;
      },
    ];

export type RunOptions<X extends object = object> = NonNullable<RunArgs<X>[0]>;

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
  /** Which seed built each row a handle holds, so `update` knows its target. */
  const owners = new WeakMap<object, SeedMeta>();
  /** Keys written per target, kept on a dry run too so it fails the same. */
  const written = new Map<unknown, Set<unknown>>();

  const targetOf = (meta: SeedMeta): Target => meta.target as Target;
  const keyOf = (meta: SeedMeta, row: object): unknown =>
    adapter.key(targetOf(meta), row as Record<string, unknown>);

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

    toolkit: (meta): Toolkit & X => {
      const name = nameOf(meta);
      const target = targetNameOf(meta);
      const within = meta.namespace ?? namespace;
      const derive = options.id ?? defaultId;
      const own = streamSeed(seed, target, within);

      return Object.assign(
        {
          now,
          random: createRandom(own),
          // Scoped by seed name, so two seeds on one target never collide.
          id: (key: string) =>
            derive({ target, key: `${name}#${key}`, namespace: within }),
        },
        options.extend?.({ seed: own, now }),
      );
    },

    stamp: (context) => adapter.stamp?.(context) ?? {},

    insert: async (meta, rows) => {
      const name = nameOf(meta);
      const targetName = targetNameOf(meta);
      const target = targetOf(meta);
      const keys = written.get(target) ?? new Set<unknown>();

      written.set(target, keys);

      for (const row of rows) {
        const key = keyOf(meta, row);

        // Two rows under one key would land as one, and a handle would
        // vouch for the row that never did.
        if (key != null && keys.has(key)) {
          throw new Error(
            `Seed "${name}" offered ${targetName} a row under key "${String(key)}", which this run already wrote. Two rows on one target need different keys.`,
          );
        }

        keys.add(key);
        owners.set(row, meta);
      }

      if (options.dryRun) {
        return;
      }

      // Private copies, so the adapter may keep them.
      const count = await adapter.insert(
        target,
        rows.map((row) => ({ ...row })),
      );

      // A short count is fine when the rows were already there and not when
      // a unique constraint rejected them, so ask rather than trust it.
      if (count !== undefined && count < rows.length && adapter.present) {
        const offered = rows.map((row) => keyOf(meta, row));
        const missing = rows.length - (await adapter.present(target, offered));

        if (missing > 0) {
          throw new Error(
            `Seed "${name}" offered ${rows.length} rows to ${targetName} but ${missing} are not in it. A unique constraint other than the primary key rejected them, so their handles would name rows that do not exist.`,
          );
        }
      }

      options.onSeed?.({ name, target: targetName, rows: rows.length });
    },

    update: async (row, values) => {
      const meta = owners.get(row);

      if (!meta) {
        throw new Error(
          "update was handed a row no seed in this run built. Pass a row from a handle.",
        );
      }

      const key = keyOf(meta, row);

      if (key == null) {
        throw new Error(
          `A row of seed "${nameOf(meta)}" has no key, so nothing can find it to update it`,
        );
      }

      if (!options.dryRun) {
        await adapter.update(targetOf(meta), key, { ...values });
      }

      Object.assign(row, values);
    },

    defer: (link) => {
      links.push(link);
    },

    // In waves: a link may pull in a seed that brings a link of its own.
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
 * Hashed directly rather than through `uuidV5`, since a custom `id` may pair
 * with a namespace that is not a uuid.
 */
function streamSeed(seed: number, target: string, namespace: string): number {
  const digest = sha1(utf8(`${seed}:${target}:${namespace}`));

  return new DataView(digest.buffer, digest.byteOffset).getUint32(0);
}

/** Without the key check a misspelt key would silently read as the default. */
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

/** Nested objects merge. Arrays replace: a partial weighting means nothing. */
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

type Plantable<Target, X extends object> =
  | Seed<Target, object, object, X>
  | SeedEntry<Seed<Target, object, object, X>>;

/** The seed behind a planting, whether it went in bare or with overrides. */
export type Planted<P> = P extends SeedEntry<infer S> ? S : P;

export type Bed<P extends ReadonlyArray<unknown>> = {
  readonly handle: <T extends Planted<P[number]>>(seeder: T) => HandleOf<T>;
};

/**
 * Seeds share what is beneath them, so a seed two of them depend on is built
 * once. A seed reached only through another is configured by planting it too.
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
