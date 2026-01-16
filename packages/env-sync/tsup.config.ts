import { defineConfig } from "tsup";

export default defineConfig({
  entryPoints: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2020",
  tsconfig: "tsconfig.build.json",
});
