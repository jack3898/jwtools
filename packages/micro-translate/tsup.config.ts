import { defineConfig } from "tsup";

export default defineConfig({
  entryPoints: ["src/index.ts", "src/intl.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2020",
  tsconfig: "tsconfig.build.json",
});
