import { describe, expect, it, vi } from "vitest";
import type { Adapter } from "./adapter";
import { type MemoryStore, memoryAdapter } from "./adapter";
import { defineSeed } from "./define";
import { seed } from "./run";

/** A stub whose insert claims to have dropped the last row offered. */
function droppingAdapter(present: boolean): Adapter<string> {
  return {
    nameOf: (target) => target,
    insert: (_target, rows) => Promise.resolve(rows.length - 1),
    ...(present
      ? {
          present: (_target, ids: ReadonlyArray<string>) =>
            Promise.resolve(ids.slice(0, -1)),
        }
      : {}),
    update: () => Promise.resolve(),
  };
}

const pair = defineSeed({
  target: "things",
  build: () => [{ n: 1 }, { n: 2 }],
});

describe("the insert check", () => {
  it("rejects rows the adapter reports as dropped and absent", async () => {
    await expect(
      seed(droppingAdapter(true), [{ seeder: pair }]),
    ).rejects.toThrow(
      'Seed "things" offered 2 rows to things but 1 are not in it',
    );
  });

  it("trusts the adapter when it cannot say which rows are present", async () => {
    await expect(
      seed(droppingAdapter(false), [{ seeder: pair }]),
    ).resolves.toBeDefined();
  });

  it("trusts an adapter that cannot count", async () => {
    const adapter: Adapter<string> = {
      nameOf: (target) => target,
      insert: () => Promise.resolve(undefined),
      present: () => Promise.resolve([]),
      update: () => Promise.resolve(),
    };

    await expect(seed(adapter, [{ seeder: pair }])).resolves.toBeDefined();
  });
});

describe("dry runs", () => {
  it("touch neither insert nor update", async () => {
    const adapter = memoryAdapter<string>();
    const insert = vi.spyOn(adapter, "insert");
    const update = vi.spyOn(adapter, "update");
    const linked = defineSeed({
      target: "linked",
      build: () => [{ value: 1 }],
      link: ({ rows, update }) => update(rows[0]?.id ?? "", { value: 2 }),
    });

    await seed(adapter, [{ seeder: linked }], { dryRun: true });

    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("ids", () => {
  it("lets a row bring its own", async () => {
    const adapter = memoryAdapter<string>();
    const named = defineSeed({
      target: "named",
      build: () => [{ id: "chosen", value: 1 }, { value: 2 }],
    });
    const [handle] = await seed(adapter, [{ seeder: named }]);

    expect(handle.all[0]?.id).toBe("chosen");
    expect(handle.all[1]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("can derive through a custom function", async () => {
    const adapter = memoryAdapter<string>();
    const [handle] = await seed(adapter, [{ seeder: pair }], {
      id: ({ target, key, namespace }) => `${namespace}/${target}/${key}`,
      namespace: "ns",
    });

    expect(handle.all.map((row) => row.id)).toEqual([
      "ns/things/things#0",
      "ns/things/things#1",
    ]);
  });

  it("derive from the raw target name, so a renamed seed keeps them", async () => {
    const adapter = memoryAdapter<string>();
    const [plain] = await seed(adapter, [{ seeder: pair }], { dryRun: true });
    const [renamed] = await seed(
      adapter,
      [
        {
          seeder: defineSeed({
            target: "things",
            name: "renamed",
            build: () => [{ n: 1 }],
          }),
        },
      ],
      { dryRun: true },
    );

    // Same target and index, different seed name: the key differs by name,
    // so the ids do too. Only the target half is shared.
    expect(plain.first().id).not.toBe(renamed.first().id);
    expect(renamed.first().id).toBe(
      (
        await seed(
          adapter,
          [
            {
              seeder: defineSeed({
                target: "things",
                name: "renamed",
                build: () => [{ n: 9 }],
              }),
            },
          ],
          { dryRun: true },
        )
      )[0].first().id,
    );
  });
});

describe("links", () => {
  it("drain in waves, so a link may pull in a seed with a link of its own", async () => {
    const store: MemoryStore<string> = new Map();
    const adapter = memoryAdapter<string>({ store });
    const order: Array<string> = [];
    const inner = defineSeed({
      target: "inner",
      build: () => [{ value: 1 }],
      link: () => {
        order.push("inner link");

        return Promise.resolve();
      },
    });
    const outer = defineSeed({
      target: "outer",
      build: () => [{ value: 1 }],
      link: async ({ get }) => {
        order.push("outer link");
        await get(inner);
      },
    });

    await seed(adapter, [{ seeder: outer }]);

    expect(order).toEqual(["outer link", "inner link"]);
    expect(store.get("inner")?.size).toBe(1);
  });
});

describe("handles", () => {
  const teams = defineSeed({
    target: "teams",
    build: () => [{ name: "Red" }, { name: "Blue" }],
    accessors: ({ rows }) => ({
      names: () => rows.map((team) => team.row.name),
    }),
  });
  const players = defineSeed({
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
    const adapter = memoryAdapter<string>({ store });

    const [playerHandle, teamHandle] = await seed(adapter, [
      { seeder: players },
      { seeder: teams },
    ]);

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
    const adapter = memoryAdapter<string>({ store });

    const [, teamHandle] = await seed(
      adapter,
      [{ seeder: players }, { seeder: teams }],
      { dryRun: true },
    );

    expect(teamHandle.names()).toEqual(["Crimson", "Blue"]);
    expect(store.size).toBe(0);
  });
});

describe("config", () => {
  it("merges nested objects and replaces arrays", async () => {
    const adapter = memoryAdapter<string>();
    const seen: Array<unknown> = [];
    const configured = defineSeed({
      target: "configured",
      defaults: { range: { min: 1, max: 5 }, weights: [1, 2, 3] },
      build: ({ config }) => {
        seen.push(config);

        return [];
      },
    });

    await seed(adapter, [
      { seeder: configured, config: { range: { max: 9 }, weights: [7] } },
    ]);

    expect(seen).toEqual([{ range: { min: 1, max: 9 }, weights: [7] }]);
  });

  it("rejects a seed listed twice, since it can only take one config", async () => {
    const adapter = memoryAdapter<string>();
    const things = defineSeed({ target: "things", build: () => [] });

    await expect(
      seed(adapter, [{ seeder: things }, { seeder: things }]),
    ).rejects.toThrow('Seed "things" is listed twice');
  });
});
