import { defineConfig } from "tsup";

export default defineConfig({
  entryPoints: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "ES6",
  tsconfig: "tsconfig.build.json",
});
