import type { AnyFn, LazyOpts } from "./types";

/**
 * Given an existing object literal, this utility function will inject a new property into the object that will be lazily evaluated when accessed.
 *
 * **This function will mutate the original object.**
 *
 * Subsequent calls to the property will return the same value/reference as the first call.
 *
 * @example ```ts
 * const target = { test: "hello" };
 *
 * injectLazyProp(target, "test2", () => "there");
 *
 * console.log(target.test2); // "there"
 * ```
 *
 * @param target The object to inject the property into
 * @param property The key name of the property to inject
 * @param getter The function that will be called to lazily evaluate the property
 */
export function injectLazyProp<
  T extends Record<PropertyKey, unknown>,
  K extends string,
  F extends AnyFn,
>(
  target: T,
  property: K,
  getter: F,
  opts: LazyOpts<K> = {},
): asserts target is {
  // It's a bit of a mess, but this cleans up nasty intersection types when the function is called sequentially in an app
  // and generates a clean easy-to-read type for the user. Extracting to a utility type does not work here.
  [K2 in keyof (T & { [Key in K]: ReturnType<F> })]: (T & {
    [Key in K]: ReturnType<F>;
  })[K2];
} {
  const { onAccess } = opts;

  Object.defineProperty(target, property, {
    get() {
      const value = getter();
      onAccess?.(property);

      Object.defineProperty(target, property, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });

      return value;
    },
    set(value) {
      Object.defineProperty(target, property, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    },
    enumerable: true,
    configurable: true,
  });
}
