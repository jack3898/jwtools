import { publisherSchema } from "../schema.js";
import { seeder } from "../setup.js";

export const publishers = seeder({
  target: publisherSchema,
  name: "publishers",
  defaults: { names: ["Penguin"] },
  build: ({ config, id }) =>
    config.names.map((name) => ({ id: id(name), name })),
  accessors: ({ rows }) => ({
    byName: (name: string) => {
      const found = rows.find((publisher) => publisher.name === name);

      if (!found) {
        throw new Error(`No publisher named "${name}"`);
      }

      return found;
    },
  }),
});
