import { authorSchema } from "../schema.js";
import { seeder } from "../setup.js";
import { publishers } from "./publishers.js";

export const authors = seeder({
  target: authorSchema,
  name: "authors",
  defaults: { perPublisher: { min: 2, max: 2 } },
  // No dependency list anywhere: `get(publishers)` IS the dependency.
  build: async ({ config, random, faker, id, get }) => {
    const { all } = await get(publishers);

    return all.flatMap((publisher, publisherIndex) =>
      Array.from(
        { length: random.int(config.perPublisher) },
        (_, authorIndex) => ({
          id: id(`${publisherIndex}-${authorIndex}`),
          publisherId: publisher.id,
          name: faker.person.fullName(),
          // A second derived id, for a column that must be unique and stable.
          email: `${id(`email#${publisherIndex}-${authorIndex}`).slice(0, 8)}@example.test`,
        }),
      ),
    );
  },
  accessors: ({ rows, random }) => ({
    forPublisher: (publisherId: string) =>
      rows.filter((author) => author.publisherId === publisherId),
    pickRandom: () => random.pick(rows),
  }),
});
