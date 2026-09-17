import { describe, expect, it } from "vitest";
import { createRandom } from "./random";

describe("createRandom", () => {
  it("replays the same sequence for the same seed", () => {
    const draw = (seed: number) => {
      const random = createRandom(seed);

      return Array.from({ length: 5 }, () => random.float());
    };

    expect(draw(1)).toEqual(draw(1));
    expect(draw(1)).not.toEqual(draw(2));
  });

  it("draws ints inclusive of both ends", () => {
    const random = createRandom(3);
    const seen = new Set(
      Array.from({ length: 500 }, () => random.int({ min: 1, max: 3 })),
    );

    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it("rejects an inverted range", () => {
    expect(() => createRandom(1).int({ min: 2, max: 1 })).toThrow(
      "Invalid range",
    );
  });

  it("refuses to pick from nothing", () => {
    expect(() => createRandom(1).pick([])).toThrow("empty list");
  });

  it("picks many distinct elements, clamped to the list", () => {
    const random = createRandom(5);
    const picked = random.pickMany(["a", "b", "c"], { min: 2, max: 10 });

    expect(new Set(picked).size).toBe(picked.length);
    expect(picked.length).toBeGreaterThanOrEqual(2);
    expect(picked.length).toBeLessThanOrEqual(3);
  });

  it("never draws a zero weight", () => {
    const random = createRandom(9);
    const values = Array.from({ length: 200 }, () =>
      random.weighted([
        { value: "never", weight: 0 },
        { value: "sometimes", weight: 1 },
        { value: "often", weight: 3 },
      ]),
    );

    expect(values).not.toContain("never");
    expect(values).toContain("sometimes");
    expect(values).toContain("often");
  });

  it("shuffles a copy", () => {
    const random = createRandom(2);
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = random.shuffle(items);

    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...shuffled].sort()).toEqual(items);
    expect(shuffled).not.toEqual(items);
  });

  it("draws dates inside the window", () => {
    const random = createRandom(4);
    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-02-01T00:00:00Z");

    for (let index = 0; index < 50; index++) {
      const drawn = random.dateBetween(from, to).getTime();

      expect(drawn).toBeGreaterThanOrEqual(from.getTime());
      expect(drawn).toBeLessThan(to.getTime());
    }
  });
});
