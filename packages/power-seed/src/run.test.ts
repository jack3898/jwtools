import { describe, expect, it, vi } from "vitest";
import type { Adapter } from "./adapter";
import { memoryAdapter } from "./adapter";
import { defineSeed } from "./define";
import { seedOne } from "./run";

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
    await expect(seedOne(droppingAdapter(true), pair)).rejects.toThrow(
      'Seed "things" offered 2 rows to things but 1 are not in it',
    );
  });

  it("trusts the adapter when it cannot say which rows are present", async () => {
    await expect(seedOne(droppingAdapter(false), pair)).resolves.toBeDefined();
  });

  it("trusts an adapter that cannot count", async () => {
    const adapter: Adapter<string> = {
      nameOf: (target) => target,
      insert: () => Promise.resolve(undefined),
      present: () => Promise.resolve([]),
      update: () => Promise.resolve(),
    };

    await expect(seedOne(adapter, pair)).resolves.toBeDefined();
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

    await seedOne(adapter, linked, {}, { dryRun: true });

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
    const handle = await seedOne(adapter, named);

    expect(handle.all[0]?.id).toBe("chosen");
    expect(handle.all[1]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("can derive through a custom function", async () => {
    const adapter = memoryAdapter<string>();
    const handle = await seedOne(
      adapter,
      pair,
      {},
      {
        id: ({ target, key, namespace }) => `${namespace}/${target}/${key}`,
        namespace: "ns",
      },
    );

    expect(handle.all.map((row) => row.id)).toEqual([
      "ns/things/things#0",
      "ns/things/things#1",
    ]);
  });

  it("derive from the raw target name, so a renamed seed keeps them", async () => {
    const adapter = memoryAdapter<string>();
    const plain = await seedOne(adapter, pair, {}, { dryRun: true });
    const renamed = await seedOne(
      adapter,
      defineSeed({
        target: "things",
        name: "renamed",
        build: () => [{ n: 1 }],
      }),
      {},
      { dryRun: true },
    );

    // Same target and index, different seed name: the key differs by name,
    // so the ids do too. Only the target half is shared.
    expect(plain.first().id).not.toBe(renamed.first().id);
    expect(renamed.first().id).toBe(
      (
        await seedOne(
          adapter,
          defineSeed({
            target: "things",
            name: "renamed",
            build: () => [{ n: 9 }],
          }),
          {},
          { dryRun: true },
        )
      ).first().id,
    );
  });
});

describe("links", () => {
  it("drain in waves, so a link may pull in a seed with a link of its own", async () => {
    const adapter = memoryAdapter<string>();
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

    await seedOne(adapter, outer);

    expect(order).toEqual(["outer link", "inner link"]);
    expect(adapter.rows("inner")).toHaveLength(1);
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

    await seedOne(adapter, configured, {
      configured: { range: { max: 9 }, weights: [7] },
    });

    expect(seen).toEqual([{ range: { min: 1, max: 9 }, weights: [7] }]);
  });
});
