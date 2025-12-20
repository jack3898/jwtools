import type { QueryAst } from "./types";

/**
 * Walks the query abstract syntax tree (AST), calling the provided function for each node.
 *
 * This can be useful for debugging or query analysis.
 *
 * @example
 * ```ts
 * import { and, or, predicate } from "@jack3898/match-collection";
 * import { walk } from "@jack3898/match-collection/helpers";
 *
 * const query = or(
 *   and("apple", "banana"),
 *   predicate((item) => item.length > 5, "length greater than 5"),
 * );
 *
 * walk(query.ast, (node) => {
 *   console.log(`Visiting node: ${node.toString()}`);
 * });
 * ```
 */
export function walk<T>(
  ast: QueryAst<T>,
  fn: (node: QueryAst<T>) => void,
): void {
  fn(ast);

  switch (ast.kind) {
    case "and":
    case "not":
    case "or": {
      for (const child of ast.children) {
        walk(child, fn);
      }

      break;
    }
    case "value":
    case "predicate": {
      // No children to walk
      break;
    }
  }
}
