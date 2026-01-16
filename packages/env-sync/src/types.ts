export interface TokenType {
  readonly value: string;
  toString(): string;
}

export type ValueSurrounding = '"' | "'" | undefined;
