/**
 * The same engine as index.ts, laid out across files the way an app would.
 * Run it with:
 *
 *   pnpm nx run @jack3898/playground:dev:power-seed-library
 *
 * It reruns on save. The pieces:
 *
 *   schema.ts      the Zod schemas, standing in for tables
 *   setup.ts       the `seed` pinned to its extras, the adapter, and `extend`
 *   factories/     one seed per file, each asking for what it depends on
 *   library.ts     the run, and printing what came out
 */
import { plant, type SeedReport } from "@jack3898/power-seed";
import { authors, books, publishers } from "./factories/index.js";
import { adapter, extend } from "./setup.js";

const reports: Array<SeedReport> = [];

const bed = await plant(
  {
    into: adapter,
    // `books` alone would build all three. The other two are planted so one
    // can be configured and both can be read back.
    seeds: [
      books,
      authors,
      publishers.override({ names: ["Penguin", "Faber"] }),
    ],
  },
  { extend, onSeed: (report) => reports.push(report) },
);

// Deepest first: a seed is written before anything that asked for it.
console.table(reports);

for (const publisher of bed.handle(publishers).all) {
  const theirs = bed.handle(authors).forPublisher(publisher.id);
  // Set by the link in books.ts, once both sides were in.
  const flagship = bed
    .handle(books)
    .all.find((book) => book.id === publisher.flagshipBookId);

  console.log(
    `${publisher.name}: ${theirs.map((author) => author.name).join(", ")}. Flagship: ${flagship?.title} (${flagship?.pages} pages)`,
  );
}
