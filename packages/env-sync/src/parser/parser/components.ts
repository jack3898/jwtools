import type { TokenType } from "../../types";
import type { Comment } from "../scanner/components";

export class Line implements TokenType {
  readonly #left: TokenType;
  readonly #operator: TokenType;
  readonly #right: TokenType;
  #comment: TokenType | undefined;

  constructor(
    key: TokenType,
    operator: TokenType,
    value: TokenType,
    comment?: TokenType,
  ) {
    this.#left = key;
    this.#operator = operator;
    this.#right = value;
    this.#comment = comment;
  }

  toString(): string {
    let result = `${this.#left.toString()}${this.#operator.toString()}${this.value.toString()}`;

    if (this.#comment) {
      result += ` ${this.#comment.toString()}`;
    }

    return result;
  }

  get key(): string {
    return this.#left.value;
  }

  get value(): string {
    return this.#right.value;
  }
}

export type ParserTokenType = Line | Comment;
