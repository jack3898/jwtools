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
import { date } from "./date";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

describe("date", () => {
  it("infers a `Date | number` parameter under its name", () => {
    const when = msg`${date("day")}`;

    expectTypeOf(when).parameter(0).toEqualTypeOf<{ day: Date | number }>();
  });

  it("rejects a string argument", () => {
    const when = msg`${date("day")}`;

    // @ts-expect-error - `day` must be a Date or a number.
    when({ day: "2020-01-15" });
  });
});
