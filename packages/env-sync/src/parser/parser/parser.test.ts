import { expect, it } from "vitest";
import { Comment, Key, Operator, Value } from "../scanner/components";
import { Scanner } from "../scanner/scanner";
import { KeyValuePair } from "./components";
import { Parser } from "./parser";

it("should parse the scanned output", () => {
  const parser = new Parser(new Scanner("KEY=VALUE"));

  parser.parse();

  expect(parser.tokens()).toEqual([
    new KeyValuePair(new Key("KEY"), new Operator("="), new Value("VALUE")),
  ]);
});

it("should parse scanned output with comments and empty lines", () => {
  const input = `
# This is a comment
            KEY1=VALUE1

KEY2='VALUE2'      # Inline comment
# Dedicated comment
`;

  const parser = new Parser(new Scanner(input));

  expect(parser.parse()).toEqual([
    new Comment("This is a comment"),
    new KeyValuePair(new Key("KEY1"), new Operator("="), new Value("VALUE1")),
    new KeyValuePair(
      new Key("KEY2"),
      new Operator("="),
      new Value("VALUE2", "'"),
    ).addComment(new Comment("Inline comment")),
    new Comment("Dedicated comment"),
  ]);
});

it("should parse a simple commented line", () => {
  const input = `# This is a comment`;

  const parser = new Parser(new Scanner(input));

  expect(parser.parse()).toEqual([new Comment("This is a comment")]);
});

it("should parse a .env input with quoted values", () => {
  const input = `KEY1="VALUE WITH SPACES"
KEY2='ANOTHER VALUE'`;

  const parser = new Parser(new Scanner(input));

  expect(parser.parse()).toEqual([
    new KeyValuePair(
      new Key("KEY1"),
      new Operator("="),
      new Value("VALUE WITH SPACES", '"'),
    ),
    new KeyValuePair(
      new Key("KEY2"),
      new Operator("="),
      new Value("ANOTHER VALUE", "'"),
    ),
  ]);
});

it("should throw an error for invalid input", () => {
  const input = `=VALUE WITHOUT KEY`;

  expect(() => new Parser(new Scanner(input)).parse()).toThrowError();
});
