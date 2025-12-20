export type LazyOpts<K> = {
  onAccess?: (key: K) => void;
};

export type AnyFn = (...args: unknown[]) => unknown;

export type ResolvedGetters<T extends Record<string, AnyFn>> = {
  [K in keyof T]: ReturnType<T[K]>;
};
