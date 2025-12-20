# Match Collection

A tiny zero-dependency package that lets you match whether a list of items meets a very specific condition.

## match()

Using `match()` you can match a collection against a tree of conditions.

Basic usage:

```ts
const matches = match(["hello", "there"]).with(or("hello", "world", "there"));
// Output: true
console.log(matches);
```

More advanced usage with combinators:

```ts
const complexQuery = or(
  and("apple", not("banana")),
  and(
    "date",
    and(
      "fig",
      not("grape"),
      // Warning: this predicate will be called for each item in the collection which may have performance implications
      predicate((item) => item.length > 3, "length greater than 3")
    )
  )
);

const matches = match(["date", "fig", "kiwi"]).with(complexQuery);
// Output: true
console.log(matches);
```

## Primary use case

This package is useful for filtering collections of items based on complex criteria. Using it to determine if someone has permission to perform an action is a common use case like:

> Can user edit document X if they can view it AND (they are the owner OR they are an admin)?

> Can a user access resource X if the feature is enabled AND they belong to group Y OR they have role Z?

## Type safety

This package is extremely type safe. The type signature of the items being matched is preserved throughout the entire matching process.

It's recommended to type your input with `as const` assertions to get the most out of the type safety features.

E.g.:

```ts
const items = ["apple", "banana", "cherry"] as const;

const matches = match(items).with(
  or(
    eq("apple"),
    and("banana", not("cherry"), "fig") // TS error: "fig" is not in items
  )
);
```

## Pretty print query

Each query node has a `toString()` method that pretty-prints the query structure. Useful for logging, debugging, or analyzing queries.

```ts
const query = or<string>(
  and("apple", not("banana")),
  predicate((item) => item.startsWith("ch"), 'starts with "ch"')
);

console.log(query.toString()); // Output: (("apple" and not "banana") or starts with "ch")
```

## Walk the tree

You can walk the query AST using the `walk` helper function for even more advanced use cases.

```ts
import { walk } from "@jack3898/match-collection/helpers";

const query = or("apple", "banana");

walk(query.ast, (node) => {
  console.log(`Visiting node: ${node.toString()}`);
});
```

One use case is determining the scope of a query by collecting values from the query, then using that to optimize any tooling to fetch results to match against later on. E.g. if a match only ever checks a subset of rules, why fetch all possible data to match with?

## Note on module type

This package is distributed with ESM syntax only.

I apologise in advance for any inconvenience this may cause.
