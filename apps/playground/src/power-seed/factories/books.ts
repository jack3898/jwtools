import { bookSchema } from "../schema.js";
import { defineSeed } from "../setup.js";
import { authors } from "./authors.js";
import { publishers } from "./publishers.js";

export const books = defineSeed({
  target: bookSchema,
  name: "books",
  defaults: {
    perAuthor: { min: 1, max: 2 },
    published: { withinYears: 3 },
    // Weights, not percentages: a 3 is drawn three times as often as a 1.
    length: [
      { value: "short", weight: 3 },
      { value: "long", weight: 1 },
    ],
  },
  build: async ({ config, random, faker, now, get }) => {
    const { all } = await get(authors);
    const earliest = new Date(now);

    earliest.setUTCFullYear(
      now.getUTCFullYear() - config.published.withinYears,
    );

    return all.flatMap((author) =>
      Array.from({ length: random.int(config.perAuthor) }, () => ({
        authorId: author.id,
        publisherId: author.row.publisherId,
        title: faker.book.title(),
        publishedAt: random.dateBetween(earliest, now),
        pages:
          random.weighted(config.length) === "short"
            ? random.int({ min: 80, max: 250 })
            : random.int({ min: 400, max: 900 }),
      })),
    );
  },
  accessors: ({ rows }) => ({
    forAuthor: (authorId: string) =>
      rows.filter((book) => book.row.authorId === authorId),
    longest: () =>
      [...rows].sort((a, b) => b.row.pages - a.row.pages)[0] ?? null,
  }),
  // Publishers point at books and books at publishers, so this side is set
  // once every seed has inserted. Write a reciprocal pair from one place.
  link: async ({ get, rows, updateIn }) => {
    const { all } = await get(publishers);

    for (const publisher of all) {
      const flagship = rows
        .filter((book) => book.row.publisherId === publisher.id)
        .sort((a, b) => b.row.pages - a.row.pages)[0];

      if (flagship) {
        await updateIn(publishers, publisher.id, {
          flagshipBookId: flagship.id,
        });
      }
    }
  },
});
