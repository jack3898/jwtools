export type Query<T> = ((set: ReadonlySet<T>) => boolean) & {
  ast: QueryAst<T>;
};

export type PredicateFn<T> = (item: T) => boolean;

export type QueryAst<T> =
  | { kind: "value"; value: T; toString(): string }
  | { kind: "or"; children: Array<QueryAst<T>>; toString(): string }
  | { kind: "and"; children: Array<QueryAst<T>>; toString(): string }
  | { kind: "not"; children: Array<QueryAst<T>>; toString(): string }
  | { kind: "predicate"; description: string; toString(): string };
