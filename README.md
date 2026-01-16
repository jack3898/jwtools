# JWTools

A collection of TypeScript utilities and libraries that I find useful for myself, but share with the world.

## Packages

- [@jack3898/lazy-object](./packages/lazy-object/README.md): Lazily loaded objects with properties computed at get-time.
- [@jack3898/match-collection](./packages/match-collection/README.md): A tiny zero-dependency package that lets you match whether a list of items meets a very specific condition.
- [@jack3898/templater](./packages/templater/README.md): A tiny zero-dependency package for creating type-safe string templates using plain old template literals.

## Contributing

Contributions are welcome! There's no formal process, just open an issue or a PR. If somehow this repo gets big enough, I'll formalize the process. Don't hesitate to reach out if you have any questions.

## Development

To set up the development environment, run:

```bash
pnpm install
```

To build all packages, run:

```bash
pnpm build
```

To watch and rebuild packages on file changes, run:

```bash
pnpm dev
```

To run tests for all packages, run:

```bash
pnpm test
```

To check standards compliance (linting, formatting, orphaned code, types), run:

```bash
pnpm check
```

To run a project in the sandbox for manual, run:

```bash
pnpm nx run @jack3898/playground:dev:<project-name>
```

...where you can find the project name in the package.json in the playground app folder.
