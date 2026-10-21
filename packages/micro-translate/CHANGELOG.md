# Changelog

## 0.7.0

- Added a runtime context for values only known at render time, such as the viewer's currency. Declare its shape once with `createTranslationConfig<Context>()({ ... })`: every `tool` recipe from that config receives it as a fourth argument, and every translator from its `define` takes it after the locale, `translator(locale, context)`. A config that declares no context is unchanged.
- `Translator` gained a fourth type parameter, `Context`, for typing wrappers such as a `useTranslation` hook that supply both locale and context.

## 0.6.0

- Added the `select` preset at `@jack3898/micro-translate/select`: branch a sentence by a discriminant with a fully typed, exhaustive `{ case, ...params }` value and an optional `other` fallback.
