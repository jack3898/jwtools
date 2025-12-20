import type { Query, QueryAst } from "./types";

export function isQuery<T>(val: Query<T> | T): val is Query<T> {
  return typeof val === "function";
}

export function makeQuery<T>(
  fn: (set: ReadonlySet<T>) => boolean,
  ast: QueryAst<T>,
): Query<T> {
  const query = fn as Query<T>;

  query.ast = ast;
  query.toString = ast.toString;

  return query;
}
