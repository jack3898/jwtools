import type { TokenType, ValueSurrounding } from "../../types";
import {
  carriageReturnRegex,
  keyCharRegex,
  whitespaceCharRegex,
} from "../regex";
import { Comment, Key, LineBreak, Operator, Value } from "./components";

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
  #scanned = false;

  constructor(input: string) {
    this.#input = input.replace(carriageReturnRegex, "\n");
    this.#scan();
  }

  #scan(): void {
    if (this.#scanned) {
      return;
    }

    this.#scanned = true;

    while (!this.#isAtEnd()) {
      const char = this.#consume();

      if (char === "\n") {
        this.#tokens.push(new LineBreak());
        continue;
      }

      if (char === "#") {
        this.#scanComment();
        continue;
      }

      if (whitespaceCharRegex.test(char)) {
        // Ignore whitespace
        continue;
      }

      if (keyCharRegex.test(char)) {
        this.#current--;
        this.#scanKey();
        continue;
      }

      throw new ScannerError(
        `Unexpected character '${char}'`,
        this.#current - 1,
        this.#line,
      );
    }
  }

  #isAtEnd(): boolean {
    return this.#current >= this.#input.length;
  }

  #consume(): string {
    const char = this.#input[this.#current++];

    if (char === "\n") {
      this.#line++;
    }

    return char ?? "";
  }

  #nextChar(): string {
    return this.#input[this.#current] ?? "";
  }

  #scanComment(): void {
    const newlineIndex = this.#input.indexOf("\n", this.#current);

    if (newlineIndex === -1) {
      const comment = this.#input.slice(this.#current);
      this.#current = this.#input.length;
      this.#tokens.push(new Comment(comment.trim()));
      return;
    }

    const comment = this.#input.slice(this.#current, newlineIndex);
    // Leave the newline for the main scan loop so it can emit a LineBreak token
    // and update line tracking in one place.
    this.#current = newlineIndex;
    this.#tokens.push(new Comment(comment.trim()));
  }

  #scanKey(): void {
    const start = this.#current;
    let end = start;
    let seenWhitespaceAfterKey = false;
    let seenKeyCharAfterWhitespace = false;

    while (!this.#isAtEnd()) {
      const char = this.#consume();

      if (keyCharRegex.test(char)) {
        end = this.#current;

        if (seenWhitespaceAfterKey) {
          seenKeyCharAfterWhitespace = true;
        }

        continue;
      }

      if (whitespaceCharRegex.test(char)) {
        if (!seenWhitespaceAfterKey) {
          seenWhitespaceAfterKey = true;
        } else {
          if (seenKeyCharAfterWhitespace) {
            throw new ScannerError(
              `Unexpected character '${char}' in key`,
              this.#current - 1,
              this.#line,
            );
          }
        }

        continue;
      }

      if (char === "=") {
        if (end === start) {
          throw new Error("Key cannot be empty");
        }

        const key = this.#input.slice(start, end);
        this.#tokens.push(new Key(key));
        this.#tokens.push(new Operator("="));
        this.#scanValue();
        return;
      }

      throw new ScannerError(
        `Unexpected character '${char}' in key`,
        this.#current,
        this.#line,
      );
    }
  }

  #scanValue(): void {
    let value = "";
    let openedWith: ValueSurrounding;
    let closedWith: string | undefined;

    const isClosed = (): boolean => !!openedWith && closedWith === openedWith;
    const isClosedOrNoWrapper = (): boolean => openedWith === closedWith;

    while (!this.#isAtEnd()) {
      const char = this.#consume();

      if ((char === '"' || char === "'") && !value.trim()) {
        openedWith = char;
        continue;
      }

      if (char === openedWith) {
        closedWith = char;
        continue;
      }

      if (char === "\n") {
        this.#tokens.push(new Value(value, openedWith));
        this.#tokens.push(new LineBreak());

        return;
      }

      if (whitespaceCharRegex.test(char)) {
        if (!isClosed()) {
          value += char;
        }

        if (this.#nextChar() === "#" && isClosedOrNoWrapper()) {
          this.#consume();
          this.#tokens.push(new Value(value.trim(), openedWith));
          this.#scanComment();
          return;
        }

        continue;
      }

      if (isClosed()) {
        throw new ScannerError(
          `Unexpected character '${char}' after closing quote`,
          this.#current,
          this.#line,
        );
      }

      value += char;
    }

    if (openedWith !== closedWith) {
      throw new ScannerError(
        `Unterminated quoted value starting`,
        this.#current - value.length,
        this.#line,
      );
    }

    this.#tokens.push(new Value(value.trim(), openedWith));
  }

  get tokens(): ReadonlyArray<TokenType> {
    this.#scan();
    return this.#tokens;
  }
}
