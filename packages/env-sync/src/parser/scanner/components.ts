import type { TokenType, ValueSurrounding } from "../../types";
import { groupNameDelimiterRegex } from "../regex";

export class Comment implements TokenType {
  readonly value: string;
  readonly prefix = "# ";

  constructor(comment: string) {
    this.value = comment;
  }

  toString(): string {
    return `${this.prefix}${this.value}`;
  }
}

export class Key implements TokenType {
  readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  groupName(): string | undefined {
    const parts = this.value.split(groupNameDelimiterRegex);

    if (parts.length > 1) {
      return parts[0];
    }

    return undefined;
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
