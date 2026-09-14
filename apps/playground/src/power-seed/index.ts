import { defineSeed, memoryAdapter, seed } from "@jack3898/power-seed";

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

const [teamHandle, playerHandle] = await seed(memoryAdapter(), [
  { seeder: teams },
  { seeder: players, config: { perTeam: 2 } },
]);

console.log(teamHandle.byName("Red"));
console.log(playerHandle.all);
