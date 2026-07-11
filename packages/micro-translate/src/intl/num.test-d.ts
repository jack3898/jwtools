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
import { num } from "./num";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

describe("num", () => {
  it("infers a number parameter under its name", () => {
    const available = msg`There are ${num("count")} available`;

    expectTypeOf(available).parameter(0).toEqualTypeOf<{ count: number }>();
  });

  it("rejects a non-number argument", () => {
    const available = msg`${num("count")}`;

    // @ts-expect-error - `count` must be a number.
    available({ count: "lots" });
  });
});
