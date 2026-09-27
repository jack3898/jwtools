import { memory, plant, seed } from "@jack3898/power-seed";

const teams = seed({
  target: "teams",
  defaults: { names: ["Red", "Blue"] },
  build: ({ config, id }) =>
    config.names.map((name) => ({ id: id(name), name })),
  accessors: ({ rows }) => ({
    byName: (name: string) => rows.find((team) => team.name === name),
  }),
});

const players = seed({
  target: "players",
  defaults: { perTeam: 3 },
  build: async ({ config, random, id, get }) => {
    const { all } = await get(teams); // this IS the dependency

    return all.flatMap((team) =>
      Array.from({ length: config.perTeam }, (_, index) => ({
        id: id(`${team.name}#${index}`),
        teamId: team.id,
        number: index + 1,
        rating: random.int({ min: 1, max: 99 }),
      })),
    );
  },
});

const bed = await plant({
  into: memory(),
  seeds: [teams, players.override({ perTeam: 2 })],
});

console.log(bed.handle(teams).all);
