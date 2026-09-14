import { publisherSchema } from "../schema.js";
import { defineSeed } from "../setup.js";

export const publishers = defineSeed({
  target: publisherSchema,
  name: "publishers",
  defaults: { names: ["Penguin"] },
  build: ({ config }) => config.names.map((name) => ({ name })),
  accessors: ({ rows }) => ({
    byName: (name: string) => {
      const found = rows.find((publisher) => publisher.row.name === name);

      if (!found) {
        throw new Error(`No publisher named "${name}"`);
      }

      return found;
    },
  }),
});
