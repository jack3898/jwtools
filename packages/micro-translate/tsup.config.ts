import { defineConfig } from "tsup";

export default defineConfig({
  entryPoints: [
    "src/index.ts",
    "src/intl/num.ts",
    "src/intl/plural.ts",
    "src/intl/date.ts",
    "src/intl/list.ts",
    "src/intl/relative-time.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "es2020",
  tsconfig: "tsconfig.build.json",
});
