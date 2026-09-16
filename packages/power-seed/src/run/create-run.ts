import type { Adapter } from "../adapter";
import { uuidV5 } from "../crypto/uuid-v5";
import { createRandom } from "../random";
import type { Run, SeedConfig, SeedMeta, Toolkit } from "../seeder";
import { camelCase } from "./camel-case";
import { DEFAULT_NAMESPACE, FIXED_NOW, FIXED_SEED } from "./defaults";
import type { BaseRunOptions } from "./options";
import { streamSeed } from "./stream-seed";

export function createRun<Target, X extends object>(
  adapter: Adapter<Target>,
  options: BaseRunOptions<X>,
  configs: ReadonlyMap<object, SeedConfig>,
): Run<X> {
  const seed = options.seed ?? FIXED_SEED;
  const now = options.now ?? FIXED_NOW;
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const links: Array<() => Promise<void>> = [];
  /**
   * Who is awaiting whom, by name. A cycle is a path from a dependency back
   * to its asker, however the asks interleave. Edges are never removed: a
   * settled seed's edges cannot lead to one still building, so they never
   * mislead.
   */
  const waiting = new Map<string, Set<string>>();
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

  function pathTo(
    from: string,
    to: string,
    seen = new Set<string>(),
  ): Array<string> | undefined {
    if (from === to) {
      return [from];
    }

    seen.add(from);

    for (const next of waiting.get(from) ?? []) {
      const rest = seen.has(next) ? undefined : pathTo(next, to, seen);

      if (rest) {
        return [from, ...rest];
      }
    }

    return undefined;
  }

  const run: Run<X> = {
    nameOf,

    toolkit: (meta): Toolkit & X => {
      const name = nameOf(meta);
      const target = targetNameOf(meta);
      const within = meta.namespace ?? namespace;
      const own = streamSeed(seed, target, within);

      return Object.assign(
        {
          now,
          random: createRandom(own),
          // Scoped by seed name, so two seeds on one target never collide.
          id: (key: string) => {
            const scoped = `${name}#${key}`;

            return options.id
              ? options.id({ target, key: scoped, namespace: within })
              : uuidV5(`${target}:${scoped}`, within);
          },
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

    // The run itself and links ask unguarded: nothing awaits them, so they
    // cannot close a cycle.
    getFor: (from) => {
      if (from === undefined) {
        return (dependency) => dependency.resolve(run);
      }

      const asker = nameOf(from);

      return (dependency) => {
        const name = nameOf(dependency);
        const cycle = pathTo(name, asker);

        if (cycle) {
          throw new Error(
            `Seed dependency cycle: ${[...cycle, name].join(" -> ")}`,
          );
        }

        const edges = waiting.get(asker) ?? new Set<string>();

        waiting.set(asker, edges.add(name));

        return dependency.resolve(run);
      };
    },
  };

  return run;
}
