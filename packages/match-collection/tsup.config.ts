import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/helpers.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2020",
  tsconfig: "tsconfig.build.json",
});
