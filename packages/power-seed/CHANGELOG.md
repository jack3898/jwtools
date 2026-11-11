# Changelog

## Unreleased

- `accessors` now receives the seed's resolved `config` beside `rows`: the same value `build` gets for that run, typed from `defaults`. A handle can now answer what the config decided and no row records, such as `accessors: ({ rows, config }) => ({ detailed: () => rows.filter((site) => config.detailed.includes(site.name)) })`. Accessors still do not get `get`.
- **Breaking:** `AccessorArgs` gained a type parameter for the config, placed as it is on `LinkArgs`: `AccessorArgs<Insert, X>` is now `AccessorArgs<Insert, C, X>`. Code that names the type with explicit arguments must add the config type, or `SeedConfig` where it does not read the config. Seeds that leave it to inference are unaffected.
