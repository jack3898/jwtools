/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest — they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { expectTypeOf } from "expect-type";
import { msg } from "..";
import { list } from "./list";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

describe("list", () => {
  it("infers a `string[]` parameter under its name", () => {
    const things = msg`${list("things")}`;

    expectTypeOf(things).parameter(0).toEqualTypeOf<{ things: string[] }>();
  });

  it("rejects a non-array argument", () => {
    const things = msg`${list("things")}`;

    // @ts-expect-error - `things` must be a string[].
    things({ things: "a, b, c" });
  });
});
