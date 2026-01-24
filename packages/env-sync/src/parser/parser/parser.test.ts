import { expect, it } from "vitest";
import { Comment, Key, Operator, Value } from "../scanner/components";
import { Scanner } from "../scanner/scanner";
import { Line } from "./components";
import { Parser } from "./parser";

it("should parse the scanned output", () => {
  const parser = new Parser(new Scanner("KEY=VALUE").tokens);

  expect(parser.tokens()).toEqual([
    new Line(new Key("KEY"), new Operator("="), new Value("VALUE")),
  ]);
});

it("should parse the scanned output with different quote style", () => {
  const parser = new Parser(new Scanner('KEY="VALUE"').tokens);

  expect(parser.tokens()).toStrictEqual([
    new Line(new Key("KEY"), new Operator("="), new Value("VALUE", "'")),
  ]);
});

it("should parse scanned output with comments and empty lines", () => {
  const input = `
# This is a comment
            KEY1=VALUE1

KEY2='VALUE2'      # Inline comment
# Dedicated comment
`;

  const parser = new Parser(new Scanner(input).tokens);

  expect(parser.tokens()).toEqual([
    new Comment("This is a comment"),
    new Line(new Key("KEY1"), new Operator("="), new Value("VALUE1")),
    new Line(
      new Key("KEY2"),
      new Operator("="),
      new Value("VALUE2", "'"),
      new Comment("Inline comment"),
    ),
    new Comment("Dedicated comment"),
  ]);
});

it("should parse a simple commented line", () => {
  const input = `# This is a comment`;

  const parser = new Parser(new Scanner(input).tokens);

  expect(parser.tokens()).toEqual([new Comment("This is a comment")]);
});

it("should parse a .env input with quoted values", () => {
  const input = `KEY1="VALUE WITH SPACES"
KEY2='ANOTHER VALUE'`;

  const parser = new Parser(new Scanner(input).tokens);

  expect(parser.tokens()).toEqual([
    new Line(
      new Key("KEY1"),
      new Operator("="),
      new Value("VALUE WITH SPACES", '"'),
    ),
    new Line(
      new Key("KEY2"),
      new Operator("="),
      new Value("ANOTHER VALUE", "'"),
    ),
  ]);
});

it("should throw an error for invalid input", () => {
  const input = `=VALUE WITHOUT KEY`;

  expect(() => new Parser(new Scanner(input).tokens)).toThrowError();
});
