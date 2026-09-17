import type { Adapter } from "./adapter";
import { resolveConfig } from "./config/resolve-config";
import { createRun } from "./run/create-run";
import type { RunArgs } from "./run/options";
import type { HandleOf, Seed, SeedConfig, SeedEntry } from "./seeder";

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
  const get = shared.getFor();

  for (const seeder of seeders) {
    handles.set(seeder, await get(seeder));
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
