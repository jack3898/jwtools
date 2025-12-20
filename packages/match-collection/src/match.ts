import type { Query, QueryAst, PredicateFn } from "./types";
import { isQuery, makeQuery } from "./utils";

function criterionToAst<T>(criterion: Query<T> | T): QueryAst<T> {
  if (isQuery(criterion)) {
    return criterion.ast;
  }

  return {
    kind: "value",
    value: criterion,
    toString(): string {
      return `"${String(criterion)}"`;
    },
  };
}

export function or<T>(
  ...input: Array<Query<NoInfer<T>> | NoInfer<T>>
): Query<T> {
  const childrenAst: Array<QueryAst<T>> = input.map(criterionToAst);

  return makeQuery(
    (set: ReadonlySet<T>): boolean => {
      for (const criterion of input) {
        if (!isQuery(criterion) && set.has(criterion)) {
          return true;
        }

        if (isQuery(criterion) && criterion(set)) {
          return true;
        }
      }

      return false;
    },
    {
      kind: "or",
      children: childrenAst,
      toString: () => {
        return `(${childrenAst.map((child) => child.toString()).join(" or ")})`;
      },
    },
  );
}

export function and<T>(
  ...input: Array<Query<NoInfer<T>> | NoInfer<T>>
): Query<T> {
  const childrenAst: Array<QueryAst<T>> = input.map(criterionToAst);

  return makeQuery(
    (set: ReadonlySet<T>): boolean => {
      for (const criterion of input) {
        if (!isQuery(criterion) && set.has(criterion)) {
          continue;
        }

        if (isQuery(criterion) && criterion(set)) {
          continue;
        }

        return false;
      }

      return true;
    },
    {
      kind: "and",
      children: childrenAst,
      toString: () => {
        return `(${childrenAst.map((child) => child.toString()).join(" and ")})`;
      },
    },
  );
}

export function not<T>(
  ...input: Array<Query<NoInfer<T>> | NoInfer<T>>
): Query<T> {
  const childrenAst: Array<QueryAst<T>> = input.map(criterionToAst);

  return makeQuery(
    (set: ReadonlySet<T>): boolean => {
      for (const criterion of input) {
        if (!isQuery(criterion) && set.has(criterion)) {
          return false;
        }

        if (isQuery(criterion) && criterion(set)) {
          return false;
        }
      }

      return true;
    },
    {
      kind: "not",
      children: childrenAst,
      toString: () => {
        return childrenAst
          .map((child) => `not ${child.toString()}`)
          .join(" and ");
      },
    },
  );
}

export function eq<T>(value: NoInfer<T>): Query<T> {
  return or(value);
}

/**
 * Runs a predicate function to determine if the item in the set matches.
 *
 * WARNING: This can be a lot slower than the other methods because it avoids indexed lookups. Use this with caution.
 */
export function predicate<T>(
  fn: PredicateFn<T>,
  description = "anonymous predicate",
): Query<T> {
  const predicateAst: QueryAst<T> = {
    kind: "predicate",
    description,
    toString: () => description,
  };

  return makeQuery((set: ReadonlySet<T>): boolean => {
    for (const item of set) {
      if (fn(item)) {
        return true;
      }
    }

    return false;
  }, predicateAst);
}

type MatchResult<T> = {
  with: (query: Query<T>) => boolean;
};

/**
 * Given an array or set, query if the collection meets the criteria defined in the query function.
 */
export function match<T>(
  collection: ReadonlySet<T> | Array<T>,
): MatchResult<T> {
  const set = collection instanceof Set ? collection : new Set(collection);

  return {
    with: (query: Query<T>): boolean => {
      return query(set);
    },
  };
}

export function walkQueryAst<T>(
  ast: QueryAst<T>,
  fn: (node: QueryAst<T>) => void,
): void {
  fn(ast);

  switch (ast.kind) {
    case "and":
    case "not":
    case "or": {
      for (const child of ast.children) {
        walkQueryAst(child, fn);
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
