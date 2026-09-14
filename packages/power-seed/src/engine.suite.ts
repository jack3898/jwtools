import { beforeEach, describe, expect, it } from "vitest";
import type { Adapter } from "./adapter";
import { defineSeed, type Row, type Seed } from "./define";
import { type SeedReport, seed } from "./run";

/**
 * The behaviour every adapter must exhibit, written once and run against each
 * storage layer. A harness supplies three seeds with the same shape:
 * authors, books (two per author, titled from the random stream, with a link
 * that sets each author's favourite book) and profiles (one per author).
 */
type AuthorShape = {
  readonly name: string;
  readonly favouriteBookId?: string | null | undefined;
};

type BookShape = {
  readonly authorId: string;
  readonly title: string;
};

export type Harness<Target> = {
  readonly adapter: Adapter<Target>;
  readonly authors: Seed<
    Target,
    AuthorShape,
    { readonly byName: (name: string) => Row<AuthorShape> }
  >;
  readonly books: Seed<
    Target,
    BookShape,
    { readonly forAuthor: (authorId: string) => ReadonlyArray<Row<BookShape>> }
  >;
  readonly profiles: Seed<Target, object, object>;
  /** Every stored row for a seed's target, in a stable order. */
  readonly rows: (
    seed: Seed<Target, object, object>,
  ) => Promise<ReadonlyArray<Record<string, unknown>>>;
  readonly reset: () => Promise<void>;
};

export const ADJECTIVES = ["Quiet", "Red", "Last", "Wild", "Blue"] as const;
export const NOUNS = [
  "Harbour",
  "Orchard",
  "Signal",
  "Meadow",
  "Lantern",
] as const;

export function engineSuite<Target>(
  name: string,
  harness: Harness<Target>,
): void {
  const { adapter, authors, books, profiles, rows, reset } = harness;

  describe(name, () => {
    beforeEach(() => reset());

    it("builds every dependency beneath the leaf", async () => {
      await seed(adapter, [{ seeder: books }]);

      expect(await rows(authors)).toHaveLength(3);
      expect(await rows(books)).toHaveLength(6);
    });

    it("builds a shared dependency once", async () => {
      await seed(adapter, [{ seeder: books }, { seeder: profiles }]);

      expect(await rows(authors)).toHaveLength(3);
      expect(await rows(books)).toHaveLength(6);
      expect(await rows(profiles)).toHaveLength(3);
    });

    it("hands back accessors over the rows it wrote", async () => {
      const [authorHandle, bookHandle] = await seed(adapter, [
        { seeder: authors },
        { seeder: books },
      ]);
      const author = authorHandle.byName("Author 2");
      const theirs = bookHandle.forAuthor(author.id);

      expect(authorHandle.first().row.name).toBe("Author 1");
      expect(theirs).toHaveLength(2);
      expect(theirs.every((book) => book.row.authorId === author.id)).toBe(
        true,
      );
    });

    it("applies each entry's config to its seed, wherever it sits", async () => {
      // `authors` is only reached through `books`; listing it configures it.
      await seed(adapter, [
        { seeder: authors, config: { count: 1 } },
        { seeder: books, config: { perAuthor: 3 } },
      ]);

      expect(await rows(authors)).toHaveLength(1);
      expect(await rows(books)).toHaveLength(3);
    });

    it("rejects a config key the seed does not declare", async () => {
      await expect(
        seed(adapter, [{ seeder: authors, config: { cuont: 1 } }]),
      ).rejects.toThrow(
        'Seed "authors" has no config named: cuont. Accepts: count',
      );
    });

    it("is a no-op the second time", async () => {
      await seed(adapter, [{ seeder: books }]);

      const before = await rows(books);

      await seed(adapter, [{ seeder: books }]);

      expect(await rows(books)).toEqual(before);
      expect(await rows(authors)).toHaveLength(3);
    });

    it("refuses to hand back a first row when the seed built none", async () => {
      const empty = defineSeed({
        name: "nothing",
        target: authors.target,
        build: () => [],
      });
      const [handle] = await seed(adapter, [{ seeder: empty }]);

      expect(() => handle.first()).toThrow('Seed "nothing" produced no rows');
    });

    it("reports a dependency cycle", async () => {
      const loop: Seed<Target, object, object> = defineSeed({
        name: "loop",
        target: authors.target,
        build: async ({ get }) => {
          await get(loop);

          return [];
        },
      });

      await expect(seed(adapter, [{ seeder: loop }])).rejects.toThrow(
        "Seed dependency cycle: loop -> loop",
      );
    });

    it("runs links once every seed has inserted", async () => {
      await seed(adapter, [{ seeder: books }]);

      const written = await rows(authors);
      const bookIds = new Set((await rows(books)).map((row) => row.id));

      expect(written).toHaveLength(3);

      for (const author of written) {
        expect(bookIds.has(author.favouriteBookId)).toBe(true);
      }
    });

    it("computes the same ids on a dry run as on a real one", async () => {
      const [dry] = await seed(adapter, [{ seeder: books }], { dryRun: true });

      expect(await rows(books)).toHaveLength(0);
      expect(await rows(authors)).toHaveLength(0);

      const [real] = await seed(adapter, [{ seeder: books }]);

      expect(real.all.map((row) => row.id)).toEqual(
        dry.all.map((row) => row.id),
      );
    });

    it("reports each target beneath the leaf, deepest first", async () => {
      const reports: Array<SeedReport> = [];

      await seed(adapter, [{ seeder: books }], {
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

      await seed(adapter, [{ seeder: books }]);

      const firstTitles = await titles();
      const firstIds = await ids();

      await harness.reset();
      await seed(adapter, [{ seeder: books }]);

      expect(await titles()).toEqual(firstTitles);

      await harness.reset();
      await seed(adapter, [{ seeder: books }], { seed: 7 });

      expect(await titles()).not.toEqual(firstTitles);
      // Ids derive from identity, never from the random stream.
      expect(await ids()).toEqual(firstIds);
    });

    it("derives ids within the run's namespace", async () => {
      const [first] = await seed(adapter, [{ seeder: authors }], {
        dryRun: true,
      });
      const [second] = await seed(adapter, [{ seeder: authors }], {
        dryRun: true,
        namespace: "b41f0c8a-2d67-4e19-9a3c-5f8e7d206b14",
      });

      expect(first.all.map((row) => row.id)).not.toEqual(
        second.all.map((row) => row.id),
      );
    });
  });
}
