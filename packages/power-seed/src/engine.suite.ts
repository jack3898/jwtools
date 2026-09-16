import { beforeEach, describe, expect, it } from "vitest";
import type { Adapter } from "./adapter";
import { plant, type SeedReport } from "./plant";
import { type Seed, seeder } from "./seeder";

/**
 * The behaviour every adapter must exhibit, written once and run against each
 * storage layer. A harness supplies three seeds with the same shape:
 * authors, books (two per author, titled from the random stream, with a link
 * that sets each author's favourite book) and profiles (one per author).
 */
type AuthorShape = {
  readonly id: string;
  readonly name: string;
  readonly favouriteBookId?: string | null | undefined;
};

type BookShape = {
  readonly id: string;
  readonly authorId: string;
  readonly title: string;
};

export type Harness<Target> = {
  readonly adapter: Adapter<Target>;
  readonly authors: Seed<
    Target,
    AuthorShape,
    { readonly byName: (name: string) => AuthorShape }
  >;
  readonly books: Seed<
    Target,
    BookShape,
    { readonly forAuthor: (authorId: string) => ReadonlyArray<BookShape> }
  >;
  readonly profiles: Seed<Target, object, object>;
  /** Every stored row for a seed's target, in a stable order. */
  readonly rows: (
    seed: Seed<Target, object, object>,
  ) => Promise<ReadonlyArray<Record<string, unknown>>>;
  readonly reset: () => Promise<void>;
};

const ADJECTIVES = ["Quiet", "Red", "Last", "Wild", "Blue"] as const;
const NOUNS = ["Harbour", "Orchard", "Signal", "Meadow", "Lantern"] as const;

type Targets<Target> = {
  readonly authors: Target;
  readonly books: Target;
  readonly profiles: Target;
};

/**
 * The three seeds the suite runs over, on whatever targets a harness has.
 * A harness whose adapter cannot name its targets passes names as well.
 */
export function harnessSeeds<Target>(
  targets: Targets<Target>,
  names?: Targets<string>,
) {
  const authors = seeder({
    target: targets.authors,
    name: names?.authors,
    defaults: { count: 3 },
    build: ({ config, id }): Array<AuthorShape> =>
      Array.from({ length: config.count }, (_, index) => ({
        id: id(String(index)),
        name: `Author ${index + 1}`,
      })),
    accessors: ({ rows }) => ({
      byName: (name: string) => {
        const found = rows.find((author) => author.name === name);

        if (!found) {
          throw new Error(`No author named "${name}"`);
        }

        return found;
      },
    }),
  });

  const books = seeder({
    target: targets.books,
    name: names?.books,
    defaults: { perAuthor: 2 },
    build: async ({ config, random, id, get }): Promise<Array<BookShape>> => {
      const { all } = await get(authors);

      return all.flatMap((author, authorIndex) =>
        Array.from({ length: config.perAuthor }, (_, index) => ({
          id: id(`${authorIndex}-${index}`),
          authorId: author.id,
          title: `${random.pick(ADJECTIVES)} ${random.pick(NOUNS)}`,
        })),
      );
    },
    accessors: ({ rows }) => ({
      forAuthor: (authorId: string) =>
        rows.filter((book) => book.authorId === authorId),
    }),
    // authors.favouriteBookId points at books, which point back at authors,
    // so it can only be set once both are in.
    link: async ({ get, rows, update }) => {
      const { all } = await get(authors);

      for (const author of all) {
        const first = rows.find((book) => book.authorId === author.id);

        if (first) {
          await update(author, { favouriteBookId: first.id });
        }
      }
    },
  });

  const profiles = seeder({
    target: targets.profiles,
    name: names?.profiles,
    build: async ({ get, id }) => {
      const { all } = await get(authors);

      return all.map((author, index) => ({
        id: id(String(index)),
        authorId: author.id,
        bio: `About ${author.name}`,
      }));
    },
  });

  return { authors, books, profiles };
}

export function engineSuite<Target>(
  name: string,
  harness: Harness<Target>,
): void {
  const { adapter, authors, books, profiles, rows, reset } = harness;

  describe(name, () => {
    beforeEach(() => reset());

    it("builds every dependency beneath the leaf", async () => {
      await plant(adapter, [books]);

      expect(await rows(authors)).toHaveLength(3);
      expect(await rows(books)).toHaveLength(6);
    });

    it("builds a shared dependency once", async () => {
      await plant(adapter, [books, profiles]);

      expect(await rows(authors)).toHaveLength(3);
      expect(await rows(books)).toHaveLength(6);
      expect(await rows(profiles)).toHaveLength(3);
    });

    it("hands back accessors over the rows it wrote", async () => {
      const result = await plant(adapter, [authors, books]);
      const authorHandle = result.handle(authors);
      const bookHandle = result.handle(books);
      const author = authorHandle.byName("Author 2");
      const theirs = bookHandle.forAuthor(author.id);

      expect(authorHandle.first().name).toBe("Author 1");
      expect(theirs).toHaveLength(2);
      expect(theirs.every((book) => book.authorId === author.id)).toBe(true);
    });

    it("applies each seed's overrides, wherever it sits", async () => {
      // `authors` is only reached through `books`; listing it configures it.
      await plant(adapter, [
        authors.override({ count: 1 }),
        books.override({ perAuthor: 3 }),
      ]);

      expect(await rows(authors)).toHaveLength(1);
      expect(await rows(books)).toHaveLength(3);
    });

    it("rejects a config key the seed does not declare", async () => {
      await expect(
        plant(adapter, [authors.override({ cuont: 1 })]),
      ).rejects.toThrow(
        'Seed "authors" has no config named: cuont. Accepts: count',
      );
    });

    it("is a no-op the second time", async () => {
      await plant(adapter, [books]);

      const before = await rows(books);

      await plant(adapter, [books]);

      expect(await rows(books)).toEqual(before);
      expect(await rows(authors)).toHaveLength(3);
    });

    it("refuses to hand back a first row when the seed built none", async () => {
      const empty = seeder({
        name: "nothing",
        target: authors.target,
        build: () => [],
      });
      const handle = (await plant(adapter, [empty])).handle(empty);

      expect(() => handle.first()).toThrow('Seed "nothing" produced no rows');
    });

    it("reports a dependency cycle", async () => {
      const loop: Seed<Target, object, object> = seeder({
        name: "loop",
        target: authors.target,
        build: async ({ get }) => {
          await get(loop);

          return [];
        },
      });

      await expect(plant(adapter, [loop])).rejects.toThrow(
        "Seed dependency cycle: loop -> loop",
      );
    });

    it("runs links once every seed has inserted", async () => {
      await plant(adapter, [books]);

      const written = await rows(authors);
      const bookIds = new Set((await rows(books)).map((row) => row.id));

      expect(written).toHaveLength(3);

      for (const author of written) {
        expect(bookIds.has(author.favouriteBookId)).toBe(true);
      }
    });

    it("computes the same ids on a dry run as on a real one", async () => {
      const dry = (await plant(adapter, [books], { dryRun: true })).handle(
        books,
      );

      expect(await rows(books)).toHaveLength(0);
      expect(await rows(authors)).toHaveLength(0);

      const real = (await plant(adapter, [books])).handle(books);

      expect(real.all.map((row) => row.id)).toEqual(
        dry.all.map((row) => row.id),
      );
    });

    it("reports each target beneath the leaf, deepest first", async () => {
      const reports: Array<SeedReport> = [];

      await plant(adapter, [books], {
        onSeed: (report) => reports.push(report),
      });

      expect(reports.map((report) => [report.name, report.rows])).toEqual([
        ["authors", 3],
        ["books", 6],
      ]);
    });

    it("draws the same values for the same seed and other values for another", async () => {
      const titles = async () => (await rows(books)).map((row) => row.title);
      const ids = async () => (await rows(books)).map((row) => row.id);

      await plant(adapter, [books]);

      const firstTitles = await titles();
      const firstIds = await ids();

      await reset();
      await plant(adapter, [books]);

      expect(await titles()).toEqual(firstTitles);

      await reset();
      await plant(adapter, [books], { seed: 7 });

      expect(await titles()).not.toEqual(firstTitles);
      // Ids derive from identity, never from the random stream.
      expect(await ids()).toEqual(firstIds);
    });

    it("derives ids within the run's namespace", async () => {
      const first = (
        await plant(adapter, [authors], {
          dryRun: true,
        })
      ).handle(authors);
      const second = (
        await plant(adapter, [authors], {
          dryRun: true,
          namespace: "b41f0c8a-2d67-4e19-9a3c-5f8e7d206b14",
        })
      ).handle(authors);

      expect(first.all.map((row) => row.id)).not.toEqual(
        second.all.map((row) => row.id),
      );
    });
  });
}
