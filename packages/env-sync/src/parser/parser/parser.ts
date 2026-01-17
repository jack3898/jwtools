import type { TokenType } from "../../types";
import { Comment, Key, Operator, Value } from "../scanner/components";
import type { Scanner } from "../scanner/scanner";
import { KeyValuePair } from "./components";

class ParserError extends Error {
  constructor(message: string, line: number) {
    super(`ParserError: ${message} on line ${line}`);
  }
}

export class Parser {
  #current = 0;
  #input: TokenType[] = [];
  #lines: TokenType[] = [];

  constructor(scanner: Scanner) {
    scanner.scan();
    this.#input = scanner.tokens();
  }

  consume(): TokenType | undefined {
    const char = this.#input[this.#current++];

    return char ?? undefined;
  }

  isAtEnd(): boolean {
    return this.#current >= this.#input.length;
  }

  parse(): void {
    while (!this.isAtEnd()) {
      const token = this.consume();

      if (token instanceof Key) {
        const keyToken = token;

        this.scanKeyValuePair(keyToken);
      }

      if (token instanceof Comment) {
        this.#lines.push(token);
      }
    }
  }

  nextToken(): TokenType | undefined {
    return this.#input[this.#current] ?? undefined;
  }

  scanKeyValuePair(key: Key): void {
    const operator = this.consume();

    if (!(operator instanceof Operator)) {
      throw new ParserError(`Expected operator after key '${key.value}'`, 0);
    }

    const value = this.consume();

    if (!(value instanceof Value)) {
      throw new ParserError(
        `Expected value after operator '${operator.value}'`,
        0,
      );
    }

    if (this.nextToken() instanceof Comment) {
      const comment = this.consume();
      this.#lines.push(new KeyValuePair(key, operator, value, comment));
    } else {
      this.#lines.push(new KeyValuePair(key, operator, value));
    }
  }

  tokens(): TokenType[] {
    return this.#lines;
  }
}
