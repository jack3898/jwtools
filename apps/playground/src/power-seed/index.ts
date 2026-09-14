/**
 * A sandbox for @jack3898/power-seed. Run it with:
 *
 *   pnpm nx run @jack3898/playground:dev:power-seed
 *
 * It reruns on save. The pieces:
 *
 *   schema.ts      the Zod schemas, standing in for tables
 *   setup.ts       the typed defineSeed wrapper, the adapter, and extend
 *   factories/     one seed per file, each asking for what it depends on
 *   index.ts       knobs, the run, and printing what came out
 */
import { type SeedReport, seedMany, seedOne } from "@jack3898/power-seed";
import { authors, books, publishers } from "./factories/index.js";
import { bookSchema, publisherSchema } from "./schema.js";
import { adapter, extend } from "./setup.js";

// ---------------------------------------------------------------------------
// KNOBS. Change any of these and watch the output move (or not!).
// ---------------------------------------------------------------------------

/** Same seed, same data. Try 1, 2, 3... and note the ids never change. */
const SEED = 42;

/** Config is keyed by seed name, wherever the seed sits in the tree. */
const CONFIG = {
  publishers: { names: ["Penguin", "Faber"] },
  authors: { perPublisher: { min: 1, max: 3 } },
  books: { perAuthor: { min: 1, max: 4 }, published: { withinYears: 5 } },
  // Uncomment for a typo: the engine says which keys the seed accepts.
  // books: { perAuthr: 1 },
  // Uncomment for a key no seed claims: caught after the run.
  // reviews: { count: 3 },
};

/** The clock every date derives from. Try a different year. */
const NOW = new Date("2026-06-01T00:00:00Z");

// ---------------------------------------------------------------------------
// Running.
// ---------------------------------------------------------------------------

const reports: Array<SeedReport> = [];
const options = {
  seed: SEED,
  now: NOW,
  extend,
  onSeed: (report: SeedReport) => reports.push(report),
};

// A dry run writes nothing but hands back the same ids a real run inserts.
const preview = await seedOne(adapter, books, CONFIG, {
  ...options,
  dryRun: true,
});

console.log(
  `dry run: ${preview.all.length} books, ${adapter.rows(bookSchema).length} stored`,
);

// The real thing. `seedMany` hands back every handle under the key it got.
const world = await seedMany(
  adapter,
  { publishers, authors, books },
  CONFIG,
  options,
);


console.log(
  `real run: ${world.books.all.length} books, ${adapter.rows(bookSchema).length} stored`,
);
console.log(
  `same ids as the dry run: ${preview.all.every((book, index) => book.id === world.books.all[index]?.id)}`,
);

// ---------------------------------------------------------------------------
// What came out.
// ---------------------------------------------------------------------------

console.log("\nseeded, deepest first:");

for (const report of reports) {
  console.log(`  ${report.name.padEnd(12)} ${report.rows} rows`);
}

console.log("\nthe world:");

for (const publisher of world.publishers.all) {
  // The link ran: read it back from storage rather than the handle, whose
  // rows are what was built, not what a link changed afterwards.
  const stored = adapter
    .rows(publisherSchema)
    .find((row) => row.id === publisher.id);
  const flagship = world.books.all.find(
    (book) => book.id === stored?.flagshipBookId,
  );

  console.log(
    `  ${publisher.row.name} (flagship: ${flagship?.row.title ?? "none"})`,
  );

  for (const author of world.authors.forPublisher(publisher.id)) {
    console.log(`    ${author.row.name} <${author.row.email}>`);

    for (const book of world.books.forAuthor(author.id)) {
      console.log(
        `      ${book.row.title} (${book.row.pages}p, ${book.row.publishedAt.getUTCFullYear()})`,
      );
    }
  }
}

console.log(`\nlongest book: ${world.books.longest()?.row.title}`);
console.log(`a random author: ${world.authors.pickRandom().row.name}`);
console.log(
  "\nrun again with the same knobs and every line above is identical.",
);
console.log(
  `the first book's id, which no knob but the namespace can change: ${world.books.first().id}`,
);

// Things to try next:
//  - Run twice in one process: `await seedOne(adapter, books, CONFIG, options)`
//    again here and count `adapter.rows(bookSchema)`. It will not grow.
//  - Give a book `pages: 0` in factories/books.ts and see the schema reject it.
//  - Add `namespace: "b41f0c8a-2d67-4e19-9a3c-5f8e7d206b14"` to `options`
//    and watch every id change while the data stays the same.
//  - Add factories/reviews.ts that `get(books)`s, export it from the barrel,
//    and add it to `seedMany`. No wiring anywhere else.
