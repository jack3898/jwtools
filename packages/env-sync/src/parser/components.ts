import type { TokenType, ValueSurrounding } from "../types";

export class EmptyLine implements TokenType {
  readonly value = "\n";

  toString(): string {
    return this.value;
  }
}

export class Comment implements TokenType {
  readonly value: string;

  constructor(comment: string) {
    this.value = comment;
  }

  toString(): string {
    return `# ${this.value}`;
  }
}

export class Key implements TokenType {
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }
}

export class Value implements TokenType {
  readonly value: string;
  readonly surroundedBy: ValueSurrounding;

  constructor(value: string, surroundedBy?: '"' | "'") {
    this.value = value;
    this.surroundedBy = surroundedBy;
  }

  toString(): string {
    return this.value;
  }
}

export class Operator implements TokenType {
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  toString(): string {
    return this.value;
  }
}
