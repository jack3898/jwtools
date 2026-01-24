import type { TokenType } from "../../types";
import {
  Comment,
  Key,
  Operator,
  type ScannerTokenType,
  Value,
} from "../scanner/components";
import { Line, type ParserTokenType } from "./components";

class ParserError extends Error {
  constructor(message: string, line: number) {
    super(`ParserError: ${message} on line ${line}`);
  }
}

export class Parser {
  #current = 0;
  #input: ScannerTokenType[] = [];
  #lines: ParserTokenType[] = [];

  constructor(tokens: ReadonlyArray<ScannerTokenType>) {
    this.#input = [...tokens];
    this.#parse();
  }

  #consume(): TokenType | undefined {
    const char = this.#input[this.#current++];

    return char ?? undefined;
  }

  #isAtEnd(): boolean {
    return this.#current >= this.#input.length;
  }

  #parse(): void {
    while (!this.#isAtEnd()) {
      const token = this.#consume();

      if (token instanceof Key) {
        const keyToken = token;

        this.#scanKeyValuePair(keyToken);

        continue;
      }

      if (token instanceof Comment) {
        this.#lines.push(token);
      }
    }
  }

  #nextToken(): TokenType | undefined {
    return this.#input[this.#current] ?? undefined;
  }

  #scanKeyValuePair(key: Key): void {
    const operator = this.#consume();

    if (!(operator instanceof Operator)) {
      throw new ParserError(`Expected operator after key '${key.value}'`, 0);
    }

    const value = this.#consume();

    if (!(value instanceof Value)) {
      throw new ParserError(
        `Expected value after operator '${operator.value}'`,
        0,
      );
    }

    const maybeComment = this.#nextToken();

    if (maybeComment instanceof Comment) {
      this.#consume();
      this.#lines.push(new Line(key, operator, value, maybeComment));
    } else {
      this.#lines.push(new Line(key, operator, value));
    }
  }

  tokens(): ParserTokenType[] {
    return this.#lines;
  }
}
