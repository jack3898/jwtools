import { and, eq, match, not, or, predicate } from "@jack3898/match-collection";
import { walk } from "@jack3898/match-collection/helpers";

{
  const matches = match(["hello", "there"]).with(eq("hello"));
  const matches2 = match(new Set(["apple", "banana", "cherry"])).with(
    eq("banana"),
  );
  const matches3 = match(["apple", "banana", "cherry"]).with(
    or("banana", "fig"),
  );

  const matches4 = match(["apple", "banana", "cherry"] as const).with(
    or(
      "banana",
      // @ts-expect-error - not in the collection (at the type level)
      "fig",
    ),
  );

  console.log({ matches, matches2, matches3, matches4 });
}

{
  const query = or("apple", "banana");

  walk(query.ast, (node) => {
    console.log(`Visiting node: ${node.toString()}`);
  });
}

{
  const ultraComplexQuery = or<string>(
    and(
      "apple",
      not("banana"),
      predicate((item) => item.startsWith("ch"), 'starts with "ch"'),
    ),
    or(
      "date",
      and(
        "fig",
        not("grape", or(and("hello", "world"), "apple")),
        predicate((item) => item.length > 4, "length greater than 4"),
      ),
    ),
  );

  console.log(`Ultra complex query: ${ultraComplexQuery.toString()}`);
}

{
  const complexQuery = or<string>(
    and("apple", not("banana")),
    and(
      "date",
      and(
        "fig",
        not("grape"),
        predicate((item) => item.length > 3, "length greater than 3"),
      ),
    ),
  );

  const matches = match(["date", "fig", "kiwi"]).with(complexQuery);
  // Output: true
  console.log("readme example:", matches);
}

const query = or<string>(
  and("apple", not("banana")),
  predicate((item) => item.startsWith("ch"), 'starts with "ch"'),
);

console.log(query.toString());
