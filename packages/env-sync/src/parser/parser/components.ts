import type { TokenType } from "../../types";

export class KeyValuePair implements TokenType {
  readonly #left: TokenType;
  readonly #operator: TokenType;
  readonly #right: TokenType;
  #comment: TokenType | undefined;

  constructor(key: TokenType, operator: TokenType, value: TokenType) {
    this.#left = key;
    this.#operator = operator;
    this.#right = value;
  }

  toString(): string {
    let result = `${this.#left.toString()}${this.#operator.toString()}${this.value.toString()}`;

    if (this.#comment) {
      result += ` ${this.#comment.toString()}`;
    }

    return result;
  }

  addComment(comment: TokenType): this {
    this.#comment = comment;
    return this;
  }

  get key(): string {
    return this.#left.value;
  }

  get value(): string {
    return this.#right.value;
  }
}
