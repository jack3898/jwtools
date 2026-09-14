import type { Adapter } from "./adapter";
import type {
  Get,
  Handle,
  HandleOf,
  Run,
  Seed,
  SeedConfig,
  SeedMeta,
  Toolkit,
} from "./define";
import { createRandom } from "./random";
import { uuidV5 } from "./uuid";

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
  readonly seed: number;
  readonly now: Date;
};

export type IdContext = {
  readonly target: string;
  readonly key: string;
  readonly namespace: string;
};

type BaseRunOptions<X extends object> = {
  /** Seeds the random stream. Same seed, same rows. */
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
   * Built once per run and spread into every seed's toolkit. Where a faker
   * instance, seeded from `context.seed`, comes in.
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
 * The trailing arguments of `seedOne` and `seedMany`. Optional until a seed
 * needs extras, at which point leaving them off would skip `extend` unnoticed.
 */
export type RunArgs<X extends object> = object extends X
  ? [config?: SeedConfig, options?: RunOptions<X>]
  : [config: SeedConfig, options: RunOptions<X>];

function splitArgs<X extends object>(
  args: RunArgs<X>,
): [SeedConfig, BaseRunOptions<X>] {
  // The conditional keeps callers honest; by here both shapes are the same.
  const [config, options] = args as [SeedConfig?, BaseRunOptions<X>?];

  return [config ?? {}, options ?? {}];
}

/** `week_number_systems` -> `weekNumberSystems`, so config keys read naturally. */
function camelCase(value: string): string {
  return value.replaceAll(/_(\w)/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );
}

function createRun<Target, X extends object>(
  adapter: Adapter<Target>,
  options: BaseRunOptions<X>,
): Run<X> {
  const seed = options.seed ?? FIXED_SEED;
  const now = options.now ?? FIXED_NOW;
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const random = createRandom(seed);
  const extras = options.extend?.({ seed, now });
  const stack: Array<string> = [];
  /** Every seed name this run resolved, for the unused-config check. */
  const seen = new Set<string>();
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

    toolkit: (meta): Toolkit & X => {
      const target = targetNameOf(meta);
      const within = meta.namespace ?? namespace;
      const derive = options.id ?? defaultId;

      return Object.assign(
        {
          now,
          random,
          id: (key: string) => derive({ target, key, namespace: within }),
        },
        extras,
      );
    },

    stamp: (context) => adapter.stamp?.(context) ?? {},

    // Ignoring conflicts is what makes a run repeatable: ids derive from
    // identity, so a row already there is the same row.
    insert: async (meta, name, rows) => {
      const heldRows = held.get(meta.target) ?? new Map<string, object>();

      held.set(meta.target, heldRows);

      for (const { id, values } of rows) {
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

    configFor: (parent, name) => {
      seen.add(name);

      const nested = parent[name];

      return typeof nested === "object" &&
        nested !== null &&
        !Array.isArray(nested)
        ? { ...nested }
        : {};
    },

    get:
      (config): Get<X> =>
      (dependency) => {
        const dependencyName = nameOf(dependency);

        if (stack.includes(dependencyName)) {
          throw new Error(
            `Seed dependency cycle: ${[...stack, dependencyName].join(" -> ")}`,
          );
        }

        return dependency.resolve(run, config);
      },

    /** A key nothing claimed is a typo that would otherwise apply to nothing. */
    assertConfigWasUsed: (config) => {
      const unused = Object.keys(config).filter((key) => !seen.has(key));

      if (unused.length > 0) {
        throw new Error(
          `Seed config keys matched no seed: ${unused.join(", ")}. Seeded: ${[...seen].sort().join(", ")}`,
        );
      }
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
 * Seed `target` and everything it asks for. `config` is keyed by seed name,
 * `{ users: { perSite: 20 } }`, wherever that seed sits in the tree.
 */
export async function seedOne<
  Target,
  Insert extends object,
  A extends object,
  X extends object = object,
>(
  adapter: Adapter<Target>,
  target: Seed<NoInfer<Target>, Insert, A, X>,
  ...args: RunArgs<X>
): Promise<Handle<Insert, A>> {
  const [config, options] = splitArgs(args);
  const shared = createRun(adapter, options);
  const handle = await target.resolve(shared, config);

  await shared.runLinks();

  shared.assertConfigWasUsed(config);

  return handle;
}

/** The handles `seedMany` returns, under the keys the seeds came in with. */
export type Handles<S> = { readonly [K in keyof S]: HandleOf<S[K]> };

/**
 * Seed several leaves against one run, so they share what is beneath them,
 * and get every handle back under the key it was given. Seeding each
 * separately would build shared dependencies once per call and trip
 * `assertConfigWasUsed`, which rejects keys the narrower target never claims.
 */
export async function seedMany<
  Target,
  S extends Record<string, Seed<NoInfer<Target>, object, object, X>>,
  X extends object = object,
>(
  adapter: Adapter<Target>,
  seeds: S & Record<string, Seed<NoInfer<Target>, object, object, X>>,
  ...args: RunArgs<X>
): Promise<Handles<S>> {
  const [config, options] = splitArgs(args);
  const shared = createRun(adapter, options);
  const handles: Record<string, unknown> = {};

  for (const [key, seed] of Object.entries(seeds)) {
    handles[key] = await seed.resolve(shared, config);
  }

  await shared.runLinks();

  shared.assertConfigWasUsed(config);

  // Built key by key from `seeds`, so the shape is the mapped type's.
  return handles as Handles<S>;
}
