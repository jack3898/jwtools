import { describe, expect, it, vi } from "vitest";
import type { Adapter } from "./adapter";
import { type MemoryStore, memory } from "./adapter";
import { plant } from "./plant";
import { seed } from "./seeder";

/** A stub whose insert claims to have dropped the last row offered. */
function droppingAdapter(present: boolean): Adapter<string> {
  return {
    nameOf: (target) => target,
    key: (_target, row) => row.id,
    insert: (_target, rows) => Promise.resolve(rows.length - 1),
    present: present
      ? (_target, keys) => Promise.resolve(keys.length - 1)
      : undefined,
    update: () => Promise.resolve(),
  };
}

const pair = seed({
  target: "things",
  build: ({ id }) => [
    { id: id("1"), n: 1 },
    { id: id("2"), n: 2 },
  ],
});

describe("the insert check", () => {
  it("rejects rows the adapter reports as dropped and absent", async () => {
    await expect(
      plant({ into: droppingAdapter(true), seeds: [pair] }),
    ).rejects.toThrow(
      'Seed "things" offered 2 rows to things but 1 are not in it',
    );
  });

  it("trusts the adapter when it cannot say which rows are present", async () => {
    await expect(
      plant({ into: droppingAdapter(false), seeds: [pair] }),
    ).resolves.toBeDefined();
  });

  it("trusts an adapter that cannot count", async () => {
    const adapter: Adapter<string> = {
      nameOf: (target) => target,
      key: (_target, row) => row.id,
      insert: () => Promise.resolve(undefined),
      present: () => Promise.resolve(0),
      update: () => Promise.resolve(),
    };

    await expect(
      plant({ into: adapter, seeds: [pair] }),
    ).resolves.toBeDefined();
  });
});

describe("dry runs", () => {
  it("touch neither insert nor update", async () => {
    const adapter = memory<string>();
    const insert = vi.spyOn(adapter, "insert");
    const update = vi.spyOn(adapter, "update");
    const linked = seed({
      target: "linked",
      build: ({ id }) => [{ id: id("1"), value: 1 }],
      link: ({ rows, update }) => update(rows[0] ?? {}, { value: 2 }),
    });

    await plant({ into: adapter, seeds: [linked] }, { dryRun: true });

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("ids", () => {
  it("are the builder's to place, so a row without one is stored as it is", async () => {
    const store: MemoryStore<string> = new Map();
    const adapter = memory<string>({ store });
    const keyless = seed({
      target: "keyless",
      build: () => [{ value: 1 }, { value: 2 }],
    });
    const handle = (await plant({ into: adapter, seeds: [keyless] })).handle(
      keyless,
    );

    expect(handle.all).toEqual([{ value: 1 }, { value: 2 }]);
    expect(store.get("keyless")?.size).toBe(2);
  });

  it("can derive through a custom function", async () => {
    const adapter = memory<string>();
    const handle = (
      await plant(
        { into: adapter, seeds: [pair] },
        {
          id: ({ target, key, namespace }) => `${namespace}/${target}/${key}`,
          namespace: "ns",
        },
      )
    ).handle(pair);

    expect(handle.all.map((row) => row.id)).toEqual([
      "ns/things/things#1",
      "ns/things/things#2",
    ]);
  });

  it("are refused when this run already wrote them", async () => {
    const adapter = memory<string>();
    // Same target, same default name, same key: identical ids.
    const one = seed({
      target: "things",
      build: ({ id }) => [{ id: id("1") }],
    });
    const two = seed({
      target: "things",
      build: ({ id }) => [{ id: id("1") }],
    });

    await expect(
      plant({ into: adapter, seeds: [one, two] }, { dryRun: true }),
    ).rejects.toThrow(
      /^Seed "things" offered things a row under key "[0-9a-f-]{36}", which this run already wrote/,
    );
  });

  it("derive from the raw target name, so a renamed seed keeps them", async () => {
    const adapter = memory<string>();
    const plain = (
      await plant({ into: adapter, seeds: [pair] }, { dryRun: true })
    ).handle(pair);
    const renamedSeed = seed({
      target: "things",
      name: "renamed",
      build: ({ id }) => [{ id: id("1"), n: 1 }],
    });
    const renamed = (
      await plant({ into: adapter, seeds: [renamedSeed] }, { dryRun: true })
    ).handle(renamedSeed);
    const renamedAgain = seed({
      target: "things",
      name: "renamed",
      build: ({ id }) => [{ id: id("1"), n: 9 }],
    });

    // The key is scoped by seed name, so only the target half is shared.
    expect(plain.first().id).not.toBe(renamed.first().id);
    expect(renamed.first().id).toBe(
      (await plant({ into: adapter, seeds: [renamedAgain] }, { dryRun: true }))
        .handle(renamedAgain)
        .first().id,
    );
  });
});

describe("links", () => {
  it("drain in waves, so a link may pull in a seed with a link of its own", async () => {
    const store: MemoryStore<string> = new Map();
    const adapter = memory<string>({ store });
    const order: Array<string> = [];
    const inner = seed({
      target: "inner",
      build: () => [{ value: 1 }],
      link: () => {
        order.push("inner link");

        return Promise.resolve();
      },
    });
    const outer = seed({
      target: "outer",
      build: () => [{ value: 1 }],
      link: async ({ get }) => {
        order.push("outer link");
        await get(inner);
      },
    });

    await plant({ into: adapter, seeds: [outer] });

    expect(order).toEqual(["outer link", "inner link"]);
    expect(store.get("inner")?.size).toBe(1);
  });
});

describe("handles", () => {
  const teams = seed({
    target: "teams",
    build: ({ id }) => [
      { id: id("red"), name: "Red" },
      { id: id("blue"), name: "Blue" },
    ],
    accessors: ({ rows }) => ({
      names: () => rows.map((team) => team.name),
    }),
  });
  const players = seed({
    target: "players",
    build: async ({ get, id }) => {
      const { all } = await get(teams);

      return all.map((team) => ({
        id: id(team.name),
        teamId: team.id,
        captain: false,
      }));
    },
    link: async ({ rows, update, get }) => {
      for (const player of rows) {
        await update(player, { captain: true });
      }

      const { first } = await get(teams);

      await update(first(), { name: "Crimson" });
    },
  });

  it("stay live: a link's update shows in rows and accessors", async () => {
    const store: MemoryStore<string> = new Map();
    const adapter = memory<string>({ store });

    const result = await plant({ into: adapter, seeds: [players, teams] });
    const playerHandle = result.handle(players);
    const teamHandle = result.handle(teams);

    expect(playerHandle.all.map((player) => player.captain)).toEqual([
      true,
      true,
    ]);
    expect(teamHandle.names()).toEqual(["Crimson", "Blue"]);
    expect(store.get("teams")?.get(teamHandle.first().id)?.name).toBe(
      "Crimson",
    );
  });

  it("refuse to update a row that has no key", async () => {
    const adapter = memory<string>();
    const keyless = seed({
      target: "keyless",
      build: () => [{ value: 1 }],
      link: ({ rows, update }) => update(rows[0] ?? {}, { value: 2 }),
    });

    await expect(
      plant({ into: adapter, seeds: [keyless] }, { dryRun: true }),
    ).rejects.toThrow('A row of seed "keyless" has no key');
  });

  it("refuse to update a row no handle in the run holds", async () => {
    const adapter = memory<string>();
    const stray = seed({
      target: "stray",
      build: () => [{ value: 1 }],
      link: ({ update }) => update({ value: 1 }, { value: 2 }),
    });

    await expect(plant({ into: adapter, seeds: [stray] })).rejects.toThrow(
      "update was handed a row no seed in this run built",
    );
  });

  it("stay live on a dry run too, with nothing written", async () => {
    const store: MemoryStore<string> = new Map();
    const adapter = memory<string>({ store });

    const teamHandle = (
      await plant(
        { into: adapter, seeds: [players, teams] },
        {
          dryRun: true,
        },
      )
    ).handle(teams);

    expect(teamHandle.names()).toEqual(["Crimson", "Blue"]);
    expect(store.size).toBe(0);
  });
});

describe("config", () => {
  it("merges nested objects and replaces arrays", async () => {
    const adapter = memory<string>();
    const seen: Array<unknown> = [];
    const configured = seed({
      target: "configured",
      defaults: { range: { min: 1, max: 5 }, weights: [1, 2, 3] },
      build: ({ config }) => {
        seen.push(config);

        return [];
      },
    });

    await plant({
      into: adapter,
      seeds: [configured.override({ range: { max: 9 }, weights: [7] })],
    });

    expect(seen).toEqual([{ range: { min: 1, max: 9 }, weights: [7] }]);
  });

  it("rejects a seed planted twice, since it can only take one config", async () => {
    const adapter = memory<string>();
    const things = seed({ target: "things", build: () => [] });

    await expect(
      plant({ into: adapter, seeds: [things, things] }),
    ).rejects.toThrow('Seed "things" is planted twice');
  });
});

describe("accessors", () => {
  const sites = seed({
    target: "sites",
    defaults: {
      names: ["north", "south"],
      detailed: ["north"],
      visits: { min: 1, max: 5 },
    },
    build: ({ config, id }) =>
      config.names.map((name) => ({ id: id(name), name })),
    accessors: ({ rows, config }) => ({
      detailed: () =>
        rows.filter((site) => config.detailed.includes(site.name)),
      visits: () => config.visits,
    }),
  });
  const names = (rows: ReadonlyArray<{ name: string }>) =>
    rows.map((row) => row.name);

  it("read the defaults when nothing overrides them", async () => {
    const handle = (
      await plant({ into: memory<string>(), seeds: [sites] })
    ).handle(sites);

    expect(names(handle.detailed())).toEqual(["north"]);
    expect(handle.visits()).toEqual({ min: 1, max: 5 });
  });

  it("read the merged config when the seed is overridden, nested keys too", async () => {
    const handle = (
      await plant({
        into: memory<string>(),
        seeds: [sites.override({ detailed: ["south"], visits: { max: 9 } })],
      })
    ).handle(sites);

    expect(names(handle.detailed())).toEqual(["south"]);
    expect(handle.visits()).toEqual({ min: 1, max: 9 });
  });

  it("get the very config build got, and no get", async () => {
    const seen: Array<unknown> = [];
    const watched = seed({
      target: "watched",
      defaults: { range: { min: 1, max: 5 } },
      build: ({ config }) => {
        seen.push(config);

        return [];
      },
      accessors: (args) => {
        seen.push(args.config, "get" in args);

        return {};
      },
    });

    await plant({
      into: memory<string>(),
      seeds: [watched.override({ range: { max: 9 } })],
    });

    const [built, accessed, hasGet] = seen;

    expect(built).toEqual({ range: { min: 1, max: 9 } });
    expect(accessed).toBe(built);
    expect(hasGet).toBe(false);
  });

  it("answer a dependant from the run's config, planted or only reached", async () => {
    const surveys = seed({
      target: "surveys",
      build: async ({ get, id }) =>
        (await get(sites)).detailed().map((site) => ({
          id: id(site.name),
          siteId: site.id,
          site: site.name,
        })),
    });
    const sitesOf = (rows: ReadonlyArray<{ site: string }>) =>
      rows.map((row) => row.site);

    // `sites` is only reached through `surveys`, so it runs on its defaults.
    const reached = (
      await plant({ into: memory<string>(), seeds: [surveys] })
    ).handle(surveys);
    const planted = (
      await plant({
        into: memory<string>(),
        seeds: [surveys, sites.override({ detailed: ["south"] })],
      })
    ).handle(surveys);

    expect(sitesOf(reached.all)).toEqual(["north"]);
    expect(sitesOf(planted.all)).toEqual(["south"]);
  });

  it("keep each run's own config when two runs plant one seed at once", async () => {
    const adapter = memory<string>();
    const order: Array<string> = [];
    const slow = seed({
      target: "slow",
      defaults: { names: ["north", "south"], detailed: ["north"] },
      build: async ({ config, id }) => {
        order.push(`start ${config.detailed.join()}`);
        // Yields, so the other run's build starts before this one ends.
        await Promise.resolve();
        order.push(`end ${config.detailed.join()}`);

        return config.names.map((name) => ({ id: id(name), name }));
      },
      accessors: ({ rows, config }) => ({
        detailed: () =>
          rows.filter((site) => config.detailed.includes(site.name)),
      }),
    });

    const [north, south] = await Promise.all([
      plant({ into: adapter, seeds: [slow] }),
      plant({ into: adapter, seeds: [slow.override({ detailed: ["south"] })] }),
    ]);

    expect(order).toEqual([
      "start north",
      "start south",
      "end north",
      "end south",
    ]);
    expect(names(north.handle(slow).detailed())).toEqual(["north"]);
    expect(names(south.handle(slow).detailed())).toEqual(["south"]);
  });

  it("read the config on a dry run too, with nothing written", async () => {
    const store: MemoryStore<string> = new Map();
    const handle = (
      await plant(
        {
          into: memory<string>({ store }),
          seeds: [sites.override({ detailed: ["south"] })],
        },
        { dryRun: true },
      )
    ).handle(sites);

    expect(names(handle.detailed())).toEqual(["south"]);
    expect(store.size).toBe(0);
  });
});

describe("streams", () => {
  const draw = (target: string) =>
    seed({
      target,
      build: ({ random }) => [
        { value: random.int({ min: 0, max: 1_000_000 }) },
      ],
    });
  const noise = seed({
    target: "noise",
    build: ({ random }) =>
      Array.from({ length: 10 }, () => ({ value: random.float() })),
  });
  const things = draw("things");
  const dependent = seed({
    target: "dependent",
    build: async ({ get, random }) => {
      await get(noise);

      return [{ value: random.int({ min: 0, max: 1_000_000 }) }];
    },
  });

  it("give a seed the same values whatever else is in the run", async () => {
    const adapter = memory<string>();
    const options = { dryRun: true };
    const value = (handle: { first: () => { value: number } }) =>
      handle.first().value;

    const alone = (
      await plant({ into: adapter, seeds: [things] }, options)
    ).handle(things);
    const after = (
      await plant({ into: adapter, seeds: [noise, things] }, options)
    ).handle(things);
    const before = (
      await plant({ into: adapter, seeds: [things, noise] }, options)
    ).handle(things);

    expect(value(after)).toBe(value(alone));
    expect(value(before)).toBe(value(alone));
    const viaNoise = (
      await plant({ into: adapter, seeds: [dependent] }, options)
    ).handle(dependent);
    const dependentAlone = draw("dependent");
    const sameTargetAlone = (
      await plant({ into: adapter, seeds: [dependentAlone] }, options)
    ).handle(dependentAlone);

    expect(value(viaNoise)).toBe(value(sameTargetAlone));
  });

  it("hand extend a seed of the seed's own, stable across runs", async () => {
    const adapter = memory<string>();
    const seen: Array<number> = [];
    const extend = ({ seed: own }: { seed: number }) => {
      seen.push(own);

      return {};
    };

    await plant({ into: adapter, seeds: [things, noise] }, { extend });
    await plant({ into: adapter, seeds: [noise, things] }, { extend });

    const [things1, noise1, noise2, things2] = seen;

    expect(things1).toBe(things2);
    expect(noise1).toBe(noise2);
    expect(things1).not.toBe(noise1);
  });
});
