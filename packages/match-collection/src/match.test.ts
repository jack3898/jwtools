import { describe, expect, it } from "vitest";
import { and, match, not, or, predicate } from "./match.js";
import type { Query } from "./types.js";

type TestSetup = {
  match: Query<string>;
  expects: boolean;
};

const data = ["apple", "banana", "cherry", "date"];

// This is just so the test output is more readable
function createAstStrings(
  tests: Array<TestSetup>,
): Array<TestSetup & { ast: string }> {
  return tests.map((test) => {
    return {
      ...test,
      ast: test.match.toString(),
    };
  });
}

describe(`collection match on ${JSON.stringify(data)}`, () => {
  it.each(
    createAstStrings([
      {
        match: and("apple"),
        expects: true,
      },
      {
        match: and("banana", "cherry"),
        expects: true,
      },
      {
        match: and("banana", "fig"),
        expects: false,
      },
      {
        match: or("banana", "fig"),
        expects: true,
      },
      {
        match: or("fig", "grape"),
        expects: false,
      },
      {
        match: or("apple", "banana"),
        expects: true,
      },
      {
        match: and("banana", not("cherry")),
        expects: false,
      },
      {
        match: not("banana"),
        expects: false,
      },
      {
        match: not(not("banana")),
        expects: true,
      },
      {
        match: predicate(
          (item) => item.startsWith("cher"),
          'starts with "cher"',
        ),
        expects: true,
      },
      {
        match: not(
          predicate((item) => item.startsWith("z"), 'starts with "z"'),
        ),
        expects: true,
      },
      {
        match: or(
          predicate((item) => item.startsWith("ban"), 'starts with "ban"'),
          "fig",
        ),
        expects: true,
      },
      {
        match: or(and("banana", "cherry"), "fig"),
        expects: true,
      },
      {
        match: or(and("banana", "fig"), and("cherry", "hello"), "apple"),
        expects: true,
      },
      {
        match: and(or("apple"), or("banana"), or("cherry"), or("date")),
        expects: true,
      },
      {
        match: or(and("apple"), and("banana"), and("cherry"), and("date")),
        expects: true,
      },
    ]),
  )("match $ast = $expects", ({ match: query, expects }) => {
    const result = match(data).with(query);

    expect(result).toBe(expects);
  });
});

it("should generate an AST-like structure for queries", () => {
  const query = and<string>(
    "apple",
    or(
      "banana",
      and(
        "date",
        predicate((item) => item.length > 3, "length > 3"),
      ),
      predicate((item) => item.startsWith("cher"), "starts with 'cher'"),
    ),
    and(not("date"), or("fig", not("banana"))),
  );

  expect(query.toString()).toMatchInlineSnapshot(
    `"("apple" and ("banana" or ("date" and length > 3) or starts with 'cher') and (not "date" and ("fig" or not "banana")))"`,
  );
});
