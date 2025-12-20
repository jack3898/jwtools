import { lazy, lazyAssign } from "@jack3898/lazy-object";

{
  const lazyObject = lazy({
    expensiveComputation: () => {
      console.log("Running pretend expensive computation...");

      return 1;
    },
  });

  console.log("Lazy object created.");

  console.log(lazyObject.expensiveComputation);
}

{
  const object = {
    hello: "world",
  };

  lazyAssign(object, "expensiveComputation", () => {
    console.log("Running another pretend expensive computation...");

    return 2;
  });

  console.log("Object property injected.");

  console.log(object.expensiveComputation);
}
