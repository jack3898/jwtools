import { defineSeed, memoryAdapter, seedMany } from "@jack3898/power-seed";

const teams = defineSeed({
  target: "teams",
  defaults: { names: ["Red", "Blue"] },
  build: ({ config }) => config.names.map((name) => ({ name })),
  accessors: ({ rows }) => ({
    byName: (name: string) => rows.find((team) => team.row.name === name),
  }),
});

const players = defineSeed({
  target: "players",
  defaults: { perTeam: 3 },
  build: async ({ config, random, get }) => {
    const { all } = await get(teams); // this IS the dependency

    return all.flatMap((team) =>
      Array.from({ length: config.perTeam }, (_, index) => ({
        teamId: team.id,
        number: index + 1,
        rating: random.int({ min: 1, max: 99 }),
      })),
    );
  },
});

const adapter = memoryAdapter<string>();
const world = await seedMany(
  adapter,
  { players, teams },
  { players: { perTeam: 2 } },
);

console.log(world.teams.byName("Red"));
console.log(world.players.all);
