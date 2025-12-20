# Create Lazy Object

A tiny zero-dependency package that lets you define an object literal using a utility to lazily compute properties on access.

The first access to the property is cached, and then reused for subsequent accesses.

## lazy

The first way is to use `lazy`. This method returns a new object with the lazy properties added in an immutable way.

```ts
const lazyObject = lazy({
  test: () => {
    console.log("Doing something expensive...");

    return 42;
  },
});

// Output: 42
console.log(lazyObject.test);
```

You can even merge another object into the lazy object:

```ts
const lazyObject = lazy(
  {
    test: () => {
      console.log("Doing something expensive...");

      return 42;
    },
  },
  { test2: "Not lazy" },
);
```

## assignLazy

The second way is to use `assignLazy`. This method will mutate the object passed into it, unlike `assignLazy`. It does not return anything.

```ts
const object = {
  test: "hello",
};

assignLazy(object, "test2", () => "there!");

// Output: "there!"
console.log(object.test2);
```

## Type safety

This package is one of the most type-safe packages around lazy property creation.

The `lazy` return type signature is inferred from the return type of all the getter functions.

The `assignLazy` function asserts the type signature of objects passed into it, which means not only does it inject the property at runtime, but at the type level too.

## Note on module type

This package is distributed with ESM syntax only.

I apologise in advance for any inconvenience this may cause.
