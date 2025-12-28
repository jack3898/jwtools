# Templater

A tiny zero-dependency package that helps you generate text content using type-safe template strings.

## template``

Basic usage:

```ts
const data = { name: "World" };
const generate = template`Hello, ${"name"}!`;

console.log(generate(data)); // Output: "Hello, World!"
```

## Type safety

This package is extremely type safe. The template strings enforce that all placeholders correspond to keys in the provided data object.

E.g.:

```ts
const generate = template`Hello, ${"name"}!`;

// Error: Property 'name' is missing
const string = generate({});
```

## Indexed placeholders (`$` and numbers)

You can use the exported `$` symbol to mark positional placeholders that read from arrays, or explicit numeric indices:

```ts
import { template, $ } from "@jack3898/templater";

const positional = template`Hello, ${$}! ${$}`;
console.log(positional(["friend", "How are you?"])); // "Hello, friend! How are you?"

const indexed = template`You have ${0} new messages.`;
console.log(indexed(["5"])); // "You have 5 new messages."
```

## Drawbacks

This is not a parser. It only works with simple template strings where placeholders are direct keys in the data object (so this will not work with templates stored in DBs, text files and such). If you need more complex templating, then an alternative solution like Handlebars may be more appropriate.

The main advantage to this tool is code readability and type safety when generating text content directly in code. It can shift the bulk of the core string into another place decluttering your logic, while still being easy to read and maintain.

## Note on module type

This package is distributed with ESM syntax only.

I apologise in advance for any inconvenience this may cause.
