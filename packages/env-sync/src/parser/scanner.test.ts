import { expect, it } from "vitest";
import { Comment, EmptyLine, Key, Operator, Value } from "./components";
import { Scanner } from "./scanner";

it("should scan a simple .env input", () => {
  const scanner = new Scanner("KEY=VALUE");

  scanner.scan();

  expect(scanner.tokens()).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE"),
  ]);
});

it("should scan a .env input with comments and empty lines", () => {
  const input = `
# This is a comment
            KEY1=VALUE1

KEY2='VALUE2'     # Inline comment
# Dedicated comment
`;

  const scanner = new Scanner(input);

  scanner.scan();

  expect(scanner.tokens()).toEqual([
    new EmptyLine(),
    new Comment("This is a comment"),
    new Key("KEY1"),
    new Operator("="),
    new Value("VALUE1"),
    new EmptyLine(),
    new Key("KEY2"),
    new Operator("="),
    new Value("VALUE2", "'"),
    new Comment("Inline comment"),
    new Comment("Dedicated comment"),
  ]);
});

it("should scan a .env input with quoted values", () => {
  const input = `KEY1="VALUE WITH SPACES"
KEY2='ANOTHER VALUE'`;

  const scanner = new Scanner(input);

  scanner.scan();

  expect(scanner.tokens()).toEqual([
    new Key("KEY1"),
    new Operator("="),
    new Value("VALUE WITH SPACES", '"'),
    new Key("KEY2"),
    new Operator("="),
    new Value("ANOTHER VALUE", "'"),
  ]);
});

it("should throw an error for empty keys", () => {
  const scanner = new Scanner("=VALUE");

  expect(() => scanner.scan()).toThrowError(
    "ScannerError: Unexpected character '=' at position 0 on line 1",
  );
});

it("should throw an error for invalid characters", () => {
  const scanner = new Scanner("KEY@VALUE");

  expect(() => scanner.scan()).toThrowError(
    "ScannerError: Unexpected character '@' in key at position 3 on line 1",
  );
});

it("should throw an error for unterminated quoted values", () => {
  const scanner = new Scanner(`KEY='UNTERMINATED VALUE`);

  expect(() => scanner.scan()).toThrowError(
    "ScannerError: Unterminated quoted value starting at position 4 on line 1",
  );
});

it("should allow for a comment with quoted characters (basically, it doesn't confuse a comment with a value)", () => {
  const input = `KEY=VALUE # This is a 'comment' with "quotes"`;

  const scanner = new Scanner(input);

  scanner.scan();

  expect(scanner.tokens()).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE"),
    new Comment(`This is a 'comment' with "quotes"`),
  ]);
});

it("should allow for spaces in a value without quotes with a comment", () => {
  const input = `KEY=VALUE WITH SPACES # This is a comment`;

  const scanner = new Scanner(input);

  scanner.scan();

  expect(scanner.tokens()).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE WITH SPACES"),
    new Comment("This is a comment"),
  ]);
});
