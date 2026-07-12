/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest; they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { expectTypeOf } from "expect-type";
import { msg } from ".";
import { plural } from "./intl/plural";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

describe("msg", () => {
  it("infers a single named parameter", () => {
    const greet = msg`Hey ${"name"}`;

    expectTypeOf(greet).parameter(0).toEqualTypeOf<{ name: string | number }>();
    expectTypeOf(greet).returns.toEqualTypeOf<string>();
  });

  it("infers multiple named parameters as a flat object literal", () => {
    const greet = msg`${"greeting"}, ${"name"}!`;

    expectTypeOf(greet).parameter(0).toEqualTypeOf<{
      greeting: string | number;
      name: string | number;
    }>();
  });

  it("infers no parameters for a plain template", () => {
    const plain = msg`Just text`;

    expectTypeOf(plain).parameter(0).toEqualTypeOf<Record<never, never>>();

    // An empty object is accepted.
    plain({});
  });

  it("infers a plural parameter as a number under its literal name", () => {
    const count = msg`${plural("count", { one: "file", other: "files" })}`;

    expectTypeOf(count).parameter(0).toEqualTypeOf<{ count: number }>();
  });

  it("combines named and plural parameters", () => {
    const summary = msg`${"name"} has ${plural("count", {
      one: "1 file",
      other: "many files",
    })}`;

    expectTypeOf(summary).parameter(0).toEqualTypeOf<{
      name: string | number;
      count: number;
    }>();
  });

  it("rejects a parameter name widened to string", () => {
    const name: string = "name";

    // @ts-expect-error - parameter names must be string literals.
    msg`Hey ${name}`;
  });

  it("rejects a parameter name typed as a template-literal pattern", () => {
    const name: `a${string}` = "aName";

    // @ts-expect-error - pattern names would melt the dict into an index signature.
    msg`Hey ${name}`;
  });

  it("rejects a missing parameter", () => {
    const greet = msg`Hey ${"name"}`;

    // @ts-expect-error - `name` is required.
    greet({});
  });

  it("rejects a parameter of the wrong type", () => {
    const greet = msg`Hey ${"name"}`;

    // @ts-expect-error - `name` must be a string | number, not a boolean.
    greet({ name: true });
  });
});
