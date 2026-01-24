import type { ParserTokenType } from "./parser/parser/components";
import { Parser } from "./parser/parser/parser";
import { Scanner } from "./parser/scanner/scanner";

export class EnvDocument {
  #content: ReadonlyArray<ParserTokenType>;

  constructor(content: string) {
    const scanner = new Scanner(content);
    const parser = new Parser(scanner.tokens);

    this.#content = parser.tokens();
  }

  toString(): string {
    let content = "";

    for (const token of this.#content) {
      content += token.toString() + "\n";
    }

    return content;
  }
}
