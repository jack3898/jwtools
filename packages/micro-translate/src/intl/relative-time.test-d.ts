/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest; they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { expectTypeOf } from "expect-type";
import { msg } from "..";
import { type RelativeTime, relativeTime } from "./relative-time";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

describe("relativeTime", () => {
  it("infers a `{ value, unit }` parameter under its name", () => {
    const when = msg`${relativeTime("ago")}`;

    expectTypeOf(when).parameter(0).toEqualTypeOf<{ ago: RelativeTime }>();
  });

  it("rejects a bare number argument", () => {
    const when = msg`${relativeTime("ago")}`;

    // @ts-expect-error - `ago` must be a { value, unit } object.
    when({ ago: -3 });
  });
});
