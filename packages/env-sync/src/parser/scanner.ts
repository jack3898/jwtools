import type { TokenType, ValueSurrounding } from "../types";
import { Comment, EmptyLine, Key, Operator, Value } from "./components";

const keyCharRegex = /[a-zA-Z0-9_.-]/;
const keyRegex = /^[\t\s]*[a-zA-Z0-9_.-]+[\t\s]*$/;

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
    this.#input = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
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

    if (char === "\n") {
      this.#line++;
    }

    return char ?? "";
  }

  nextChar(): string {
    return this.#input[this.#current] ?? "";
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

    this.#tokens.push(new Comment(comment.trim()));
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

        this.#tokens.push(new Key(key.trim()));
        this.#tokens.push(new Operator("="));
        this.scanValue();
        return;
      }

      if (char === " " || char === "\t") {
        key += char;

        if (keyRegex.test(key)) {
          continue;
        }
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

    // This function means that there has be a quote opened explicitly and as such tests if it's been closed
    const isClosed = (): boolean => !!openedWith && closedWith === openedWith;
    // But this one is the same as above, but also returns true if there was never a quote opened to then close
    const isClosedOrNoWrapper = (): boolean => openedWith === closedWith;

    while (!this.isAtEnd()) {
      const char = this.consume();

      // Opening quote
      if ((char === '"' || char === "'") && !value.trim()) {
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

        // If this newline is the final character in the input, emit an EmptyLine token
        if (this.isAtEnd()) {
          this.#tokens.push(new EmptyLine());
        }

        return;
      }

      if (char === " " || char === "\t") {
        if (!isClosed()) {
          value += char;
        }

        if (this.nextChar() === "#" && isClosedOrNoWrapper()) {
          this.consume();
          this.#tokens.push(new Value(value.trim(), openedWith));
          this.scanComment();

          return;
        }

        continue;
      }

      if (isClosed()) {
        throw new ScannerError(
          `Unexpected character '${char}' after closing quote`,
          this.#current - 1,
          this.#line,
        );
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
  }

  tokens(): TokenType[] {
    return this.#tokens;
  }
}
