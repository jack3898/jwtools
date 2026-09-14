import { describe, expect, it, vi } from "vitest";
import type { Adapter } from "./adapter";
import { type MemoryStore, memory } from "./adapter";
import { plant } from "./plant";
import { seeder } from "./seeder";

/** A stub whose insert claims to have dropped the last row offered. */
function droppingAdapter(present: boolean): Adapter<string> {
  return {
    nameOf: (target) => target,
    insert: (_target, rows) => Promise.resolve(rows.length - 1),
    present: present
      ? (_target, ids: ReadonlyArray<string>) =>
          Promise.resolve(ids.slice(0, -1))
      : undefined,
    update: () => Promise.resolve(),
  };
}

const pair = seeder({
  target: "things",
  build: () => [{ n: 1 }, { n: 2 }],
});

describe("the insert check", () => {
  it("rejects rows the adapter reports as dropped and absent", async () => {
    await expect(plant(droppingAdapter(true), [pair])).rejects.toThrow(
      'Seed "things" offered 2 rows to things but 1 are not in it',
    );
  });

  it("trusts the adapter when it cannot say which rows are present", async () => {
    await expect(plant(droppingAdapter(false), [pair])).resolves.toBeDefined();
  });

  it("trusts an adapter that cannot count", async () => {
    const adapter: Adapter<string> = {
      nameOf: (target) => target,
      insert: () => Promise.resolve(undefined),
      present: () => Promise.resolve([]),
      update: () => Promise.resolve(),
    };

    await expect(plant(adapter, [pair])).resolves.toBeDefined();
  });
});

describe("dry runs", () => {
  it("touch neither insert nor update", async () => {
    const adapter = memory<string>();
    const insert = vi.spyOn(adapter, "insert");
    const update = vi.spyOn(adapter, "update");
    const linked = seeder({
      target: "linked",
      build: () => [{ value: 1 }],
      link: ({ rows, update }) => update(rows[0]?.id ?? "", { value: 2 }),
    });

    await plant(adapter, [linked], { dryRun: true });

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("ids", () => {
  it("lets a row bring its own", async () => {
    const adapter = memory<string>();
    const named = seeder({
      target: "named",
      build: () => [{ id: "chosen", value: 1 }, { value: 2 }],
    });
    const handle = (await plant(adapter, [named])).handle(named);

    expect(handle.all[0]?.id).toBe("chosen");
    expect(handle.all[1]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("can derive through a custom function", async () => {
    const adapter = memory<string>();
    const handle = (
      await plant(adapter, [pair], {
        id: ({ target, key, namespace }) => `${namespace}/${target}/${key}`,
        namespace: "ns",
      })
    ).handle(pair);

    expect(handle.all.map((row) => row.id)).toEqual([
      "ns/things/things#0",
      "ns/things/things#1",
    ]);
  });

  it("are refused when another seed in the run already minted them", async () => {
    const adapter = memory<string>();
    const one = seeder({ target: "things", build: () => [{ n: 1 }] });
    const two = seeder({ target: "things", build: () => [{ n: 2 }] });

    await expect(plant(adapter, [one, two], { dryRun: true })).rejects.toThrow(
      /^Seed "things" minted id "[0-9a-f-]{36}" for things, which this run already wrote/,
    );
  });

  it("derive from the raw target name, so a renamed seed keeps them", async () => {
    const adapter = memory<string>();
    const plain = (await plant(adapter, [pair], { dryRun: true })).handle(pair);
    const renamedSeed = seeder({
      target: "things",
      name: "renamed",
      build: () => [{ n: 1 }],
    });
    const renamed = (
      await plant(adapter, [renamedSeed], { dryRun: true })
    ).handle(renamedSeed);
    const renamedAgain = seeder({
      target: "things",
      name: "renamed",
      build: () => [{ n: 9 }],
    });

    // Same target and index, different seed name: the key differs by name,
    // so the ids do too. Only the target half is shared.
    expect(plain.first().id).not.toBe(renamed.first().id);
    expect(renamed.first().id).toBe(
      (await plant(adapter, [renamedAgain], { dryRun: true }))
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
    const inner = seeder({
      target: "inner",
      build: () => [{ value: 1 }],
      link: () => {
        order.push("inner link");

        return Promise.resolve();
      },
    });
    const outer = seeder({
      target: "outer",
      build: () => [{ value: 1 }],
      link: async ({ get }) => {
        order.push("outer link");
        await get(inner);
      },
    });

    await plant(adapter, [outer]);

    expect(order).toEqual(["outer link", "inner link"]);
    expect(store.get("inner")?.size).toBe(1);
  });
});

describe("handles", () => {
  const teams = seeder({
    target: "teams",
    build: () => [{ name: "Red" }, { name: "Blue" }],
    accessors: ({ rows }) => ({
      names: () => rows.map((team) => team.row.name),
    }),
  });
  const players = seeder({
    target: "players",
    build: async ({ get }) => {
      const { all } = await get(teams);

      return all.map((team) => ({ teamId: team.id, captain: false }));
    },
    link: async ({ rows, update, get, updateIn }) => {
      for (const player of rows) {
        await update(player.id, { captain: true });
      }

      const { first } = await get(teams);

      await updateIn(teams, first().id, { name: "Crimson" });
    },
  });

  it("stay live: a link's update shows in rows and accessors", async () => {
    const store: MemoryStore<string> = new Map();
    const adapter = memory<string>({ store });

    const result = await plant(adapter, [players, teams]);
    const playerHandle = result.handle(players);
    const teamHandle = result.handle(teams);

    expect(playerHandle.all.map((player) => player.row.captain)).toEqual([
      true,
      true,
    ]);
    expect(teamHandle.names()).toEqual(["Crimson", "Blue"]);
    // What the handle says is what was stored.
    expect(store.get("teams")?.get(teamHandle.first().id)?.name).toBe(
      "Crimson",
    );
  });

  it("stay live on a dry run too, with nothing written", async () => {
    const store: MemoryStore<string> = new Map();
    const adapter = memory<string>({ store });

    const teamHandle = (
      await plant(adapter, [players, teams], {
        dryRun: true,
      })
    ).handle(teams);

    expect(teamHandle.names()).toEqual(["Crimson", "Blue"]);
    expect(store.size).toBe(0);
  });
});

describe("config", () => {
  it("merges nested objects and replaces arrays", async () => {
    const adapter = memory<string>();
    const seen: Array<unknown> = [];
    const configured = seeder({
      target: "configured",
      defaults: { range: { min: 1, max: 5 }, weights: [1, 2, 3] },
      build: ({ config }) => {
        seen.push(config);

        return [];
      },
    });

    await plant(adapter, [
      configured.override({ range: { max: 9 }, weights: [7] }),
    ]);

    expect(seen).toEqual([{ range: { min: 1, max: 9 }, weights: [7] }]);
  });

  it("rejects a seed planted twice, since it can only take one config", async () => {
    const adapter = memory<string>();
    const things = seeder({ target: "things", build: () => [] });

    await expect(plant(adapter, [things, things])).rejects.toThrow(
      'Seed "things" is planted twice',
    );
  });
});

describe("streams", () => {
  const draw = (target: string) =>
    seeder({
      target,
      build: ({ random }) => [
        { value: random.int({ min: 0, max: 1_000_000 }) },
      ],
    });
  const noise = seeder({
    target: "noise",
    build: ({ random }) =>
      Array.from({ length: 10 }, () => ({ value: random.float() })),
  });
  const things = draw("things");
  const dependent = seeder({
    target: "dependent",
    build: async ({ get, random }) => {
      await get(noise);

      return [{ value: random.int({ min: 0, max: 1_000_000 }) }];
    },
  });

  it("give a seed the same values whatever else is in the run", async () => {
    const adapter = memory<string>();
    const options = { dryRun: true };
    const value = (handle: { first: () => { row: { value: number } } }) =>
      handle.first().row.value;

    const alone = (await plant(adapter, [things], options)).handle(things);
    const after = (await plant(adapter, [noise, things], options)).handle(
      things,
    );
    const before = (await plant(adapter, [things, noise], options)).handle(
      things,
    );

    expect(value(after)).toBe(value(alone));
    expect(value(before)).toBe(value(alone));
    // A seed that draws after pulling in a noisy dependency is unaffected too.
    const viaNoise = (await plant(adapter, [dependent], options)).handle(
      dependent,
    );
    const dependentAlone = draw("dependent");
    const sameTargetAlone = (
      await plant(adapter, [dependentAlone], options)
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

    await plant(adapter, [things, noise], { extend });
    await plant(adapter, [noise, things], { extend });

    const [things1, noise1, noise2, things2] = seen;

    expect(things1).toBe(things2);
    expect(noise1).toBe(noise2);
    expect(things1).not.toBe(noise1);
  });
});
