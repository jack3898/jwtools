/** A closed range. `int` treats both ends as inclusive. */
export type Range = {
  readonly min: number;
  readonly max: number;
};

export type Weighted<T> = {
  readonly value: T;
  readonly weight: number;
};

export type Random = {
  /** In `[min, max)`. Defaults to `[0, 1)`. */
  readonly float: (range?: Partial<Range>) => number;
  /** In `[min, max]`, both ends inclusive. */
  readonly int: (range: Range) => number;
  /** `true` with the given probability, default an even chance. */
  readonly bool: (probability?: number) => boolean;
  /** One element. Throws on an empty list rather than hand back `undefined`. */
  readonly pick: <T>(items: ReadonlyArray<T>) => T;
  /** Between `min` and `max` distinct elements, clamped to the list's length. */
  readonly pickMany: <T>(items: ReadonlyArray<T>, range: Range) => Array<T>;
  /** One value, where a weight of 2 is drawn twice as often as a weight of 1. */
  readonly weighted: <T>(items: ReadonlyArray<Weighted<T>>) => T;
  /** A shuffled copy. The input is not touched. */
  readonly shuffle: <T>(items: ReadonlyArray<T>) => Array<T>;
  /** An instant in `[from, to)`. */
  readonly dateBetween: (from: Date, to: Date) => Date;
};

/** mulberry32: determinism, not cryptographic strength, is the requirement. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) | 0;

    let t = state;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  }

  function below(count: number): number {
    return Math.floor(next() * count);
  }

  function assertRange({ min, max }: Range): void {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new Error(`Invalid range: min ${min}, max ${max}`);
    }
  }

  const random: Random = {
    float: (range = {}) => {
      const min = range.min ?? 0;
      const max = range.max ?? 1;

      assertRange({ min, max });

      return min + next() * (max - min);
    },

    int: (range) => {
      assertRange(range);

      return below(range.max - range.min + 1) + range.min;
    },

    bool: (probability = 0.5) => next() < probability,

    pick: <T>(items: ReadonlyArray<T>): T => {
      if (items.length === 0) {
        throw new Error("Cannot pick from an empty list");
      }

      return items[below(items.length)] as T;
    },

    pickMany: (items, range) => {
      assertRange(range);

      const max = Math.min(range.max, items.length);
      const min = Math.min(range.min, max);
      const count = random.int({ min, max });

      return random.shuffle(items).slice(0, count);
    },

    weighted: <T>(items: ReadonlyArray<Weighted<T>>): T => {
      const total = items.reduce((sum, item) => sum + item.weight, 0);

      if (total <= 0) {
        throw new Error("Weighted pick needs at least one positive weight");
      }

      let remaining = next() * total;

      for (const item of items) {
        remaining -= item.weight;

        if (remaining < 0) {
          return item.value;
        }
      }

      return (items[items.length - 1] as Weighted<T>).value;
    },

    shuffle: <T>(items: ReadonlyArray<T>): Array<T> => {
      const copy = [...items];

      // Fisher-Yates, drawing from the same stream so the order is reproducible.
      for (let index = copy.length - 1; index > 0; index--) {
        const swap = below(index + 1);
        const held = copy[index] as T;

        copy[index] = copy[swap] as T;
        copy[swap] = held;
      }

      return copy;
    },

    dateBetween: (from, to) =>
      new Date(random.float({ min: from.getTime(), max: to.getTime() })),
  };

  return random;
}
