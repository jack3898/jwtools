import type { RcFile } from "syncpack";

export default {
  sortFirst: [
    "name",
    "description",
    "version",
    "author",
    "license",
    "private",
    "type",
    "main",
    "nx",
    "scripts",
    "exports",
    "dependencies",
    "devDependencies",
    "peerDependencies",
  ],
  sortPackages: true,
  source: ["package.json", "**/*/package.json"],
  lintSemverRanges: false, // The catalog in pnpm should do us fine for a while
  versionGroups: [
    {
      dependencies: ["@jackwrigatoni/*"],
      isIgnored: true, // Syncpack gets all wishy-washy with workspace:*
    },
  ],
} satisfies RcFile;
