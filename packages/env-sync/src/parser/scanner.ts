import type { TokenType, ValueSurrounding } from "../types";
import { Comment, EmptyLine, Key, Operator, Value } from "./components";

const keyCharRegex = /[a-zA-Z0-9_.-]/;

class ScannerError extends Error {
  constructor(message: string, position: number, line: number) {
    super(`ScannerError: ${message} at position ${position} on line ${line}`);
  }
}

export class Scanner {
  #input: string;
  #current = 0;
  #line = 1;
  #tokens: TokenType[] = [];

  constructor(input: string) {
    this.#input = input;
  }

  scan(): void {
    while (!this.isAtEnd()) {
      const char = this.consume();

      switch (char) {
        case "\n":
          this.scanNewline();
          break;
        case "#":
          this.scanComment();
          break;
        case " ":
        case "\t":
          // Ignore whitespace
          break;
        default:
          if (keyCharRegex.test(char)) {
            this.#current--;
            this.scanKey();
            break;
          } else {
            throw new ScannerError(
              `Unexpected character '${char}'`,
              this.#current - 1,
              this.#line,
            );
          }
      }
    }
  }

  isAtEnd(): boolean {
    return this.#current >= this.#input.length;
  }

  consume(): string {
    const char = this.#input[this.#current++];

    return char ?? "";
  }

  scanComment(): void {
    let comment = "";

    while (!this.isAtEnd()) {
      const char = this.consume();

      if (char === "\n") {
        break;
      }

      comment += char;
    }

    if (comment === "") {
      return;
    }

    this.#tokens.push(new Comment(comment.slice(1).trim()));
  }

  scanKey(): void {
    let key = "";

    while (!this.isAtEnd()) {
      const char = this.consume();

      if (keyCharRegex.test(char)) {
        key += char;
        continue;
      }

      if (char === "=") {
        if (!key) {
          throw new Error("Key cannot be empty");
        }

        this.#tokens.push(new Key(key));
        this.#tokens.push(new Operator("="));
        this.scanValue();
        return;
      }

      throw new ScannerError(
        `Unexpected character '${char}' in key`,
        this.#current - 1,
        this.#line,
      );
    }
  }

  scanValue(): void {
    let value = "";
    let openedWith: ValueSurrounding;
    let closedWith: string | undefined;

    while (!this.isAtEnd()) {
      const char = this.consume();

      // Opening quote
      if ((char === '"' || char === "'") && !value) {
        openedWith = char;
        continue;
      }

      // Closing quote
      if (char === openedWith) {
        closedWith = char;
        continue;
      }

      if (char === "\n") {
        this.#tokens.push(new Value(value, openedWith));
        return;
      }

      if (char === "#") {
        this.#tokens.push(new Value(value.trim(), openedWith));
        this.scanComment();
        return;
      }

      value += char;
    }

    if (openedWith !== closedWith) {
      throw new ScannerError(
        `Unterminated quoted value starting`,
        this.#current - value.length - 1,
        this.#line,
      );
    }

    this.#tokens.push(new Value(value.trim(), openedWith));
  }

  scanNewline(): void {
    this.#tokens.push(new EmptyLine());
    this.#line++;
  }

  tokens(): TokenType[] {
    return this.#tokens;
  }
}
