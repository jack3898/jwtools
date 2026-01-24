import { expect, it } from "vitest";
import { Comment, Key, LineBreak, Operator, Value } from "./components";
import { Scanner } from "./scanner";

it("should scan a simple .env input", () => {
  const scanner = new Scanner("KEY=VALUE");

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE"),
  ]);
});

it("should scan a .env input with comments and empty lines", () => {
  const input = `
# This is a comment
            KEY1=VALUE1

KEY2='VALUE2'      # Inline comment
# Dedicated comment
`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new LineBreak(),
    new Comment("This is a comment"),
    new LineBreak(),
    new Key("KEY1"),
    new Operator("="),
    new Value("VALUE1"),
    new LineBreak(),
    new LineBreak(),
    new Key("KEY2"),
    new Operator("="),
    new Value("VALUE2", "'"),
    new Comment("Inline comment"),
    new LineBreak(),
    new Comment("Dedicated comment"),
    new LineBreak(),
  ]);
});

it("should scan a .env input with quoted values", () => {
  const input = `KEY1="VALUE WITH SPACES"
KEY2='ANOTHER VALUE'`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY1"),
    new Operator("="),
    new Value("VALUE WITH SPACES", '"'),
    new LineBreak(),
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
    "ScannerError: Unexpected character '@' in key at position 4 on line 1",
  );
});

it("should throw an error for unterminated quoted values", () => {
  const scanner = new Scanner(`KEY='UNTERMINATED VALUE`);

  expect(() => scanner.scan()).toThrowError(
    "ScannerError: Unterminated quoted value starting at position 5 on line 1",
  );
});

it("should allow for a comment with quoted characters (basically, it doesn't confuse a comment with a value)", () => {
  const input = `KEY=VALUE # This is a 'comment' with "quotes"`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE"),
    new Comment(`This is a 'comment' with "quotes"`),
  ]);
});

it("should allow for spaces in a value without quotes with a comment", () => {
  const input = `KEY=VALUE WITH SPACES # This is a comment`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE WITH SPACES"),
    new Comment("This is a comment"),
  ]);
});

it("should not drop the first character of a comment (regression)", () => {
  const input = `# Hello`;
  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([new Comment("Hello")]);
});

it("should increment line count after a full-line comment so later errors report the correct line", () => {
  const input = `# comment
KEY@VALUE`;

  const scanner = new Scanner(input);

  expect(() => scanner.scan()).toThrowError(
    "ScannerError: Unexpected character '@' in key at position 14 on line 2",
  );
});

it("should preserve an empty comment line (a single #) as an empty Comment token", () => {
  const input = `#
KEY=VALUE`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Comment(""),
    new LineBreak(),
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE"),
  ]);
});

it("should not treat # as a comment when it is part of an unquoted value (no whitespace before #)", () => {
  const input = `URL=https://example.com/path#section`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("URL"),
    new Operator("="),
    new Value("https://example.com/path#section"),
  ]);
});

it("should not treat # as a comment when attached directly to the value (no whitespace before #)", () => {
  const input = `KEY=abc#def`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("abc#def"),
  ]);
});

it("should treat # as an inline comment when preceded by whitespace", () => {
  const input = `KEY=abc #def`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("abc"),
    new Comment("def"),
  ]);
});

it("should never treat # as an inline comment inside quoted values", () => {
  const input = `KEY="abc #def" # real comment`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("abc #def", '"'),
    new Comment("real comment"),
  ]);
});

it("should throw if there are non-whitespace characters after a closing quote before newline/comment", () => {
  const input = `KEY="abc"def`;

  const scanner = new Scanner(input);

  expect(() => scanner.scan()).toThrowError(
    "ScannerError: Unexpected character 'd' after closing quote at position 10 on line 1",
  );
});

it("should support Windows newlines (CRLF) without including \\r in the value", () => {
  const input = "KEY1=VALUE1\r\nKEY2=VALUE2\r\n";

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY1"),
    new Operator("="),
    new Value("VALUE1"),
    new LineBreak(),
    new Key("KEY2"),
    new Operator("="),
    new Value("VALUE2"),
    new LineBreak(),
  ]);
});

it("should treat a tab before # as starting an inline comment (same as space)", () => {
  const input = `KEY=VALUE\t# Inline comment`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE"),
    new Comment("Inline comment"),
  ]);
});

it("should allow whitespace before an opening quote and still treat the value as quoted", () => {
  const input = `KEY=   "VALUE WITH SPACES"`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE WITH SPACES", '"'),
  ]);
});

it("should allow whitespace around the equals operator", () => {
  const input = `  KEY   =    VALUE   `;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE"),
  ]);
});

it("should allow whitespace around the equals operator with quoted values", () => {
  const input = `  KEY   =    'VALUE WITH SPACES'   `;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE WITH SPACES", "'"),
  ]);
});

it("should allow whitespace before an opening single quote and still treat the value as quoted", () => {
  const input = `KEY=\t\t'ANOTHER VALUE'`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("ANOTHER VALUE", "'"),
  ]);
});

it("should treat multiple spaces or tabs before # as starting an inline comment", () => {
  const input = `KEY=VALUE  \t \t# Comment`;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("VALUE"),
    new Comment("Comment"),
  ]);
});

it("should support whitespace-only unquoted values (no comment)", () => {
  const input = `KEY=    `;

  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("", undefined),
  ]);
});

it("should not include whitespace after a closing quote in the value", () => {
  const input = `KEY="abc"   \n`;
  const scanner = new Scanner(input);

  expect(scanner.tokens).toEqual([
    new Key("KEY"),
    new Operator("="),
    new Value("abc", '"'),
    new LineBreak(),
  ]);
});

it("should throw if whitespace appears inside a key (e.g. K E Y)", () => {
  const input = `K E Y=VALUE`;
  const scanner = new Scanner(input);

  expect(() => scanner.scan()).toThrowError(
    "ScannerError: Unexpected character ' ' in key at position 3 on line 1",
  );
});
