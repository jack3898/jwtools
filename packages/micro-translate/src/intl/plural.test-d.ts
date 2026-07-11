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
import { plural } from "./plural";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

describe("plural", () => {
  it("infers a number parameter under its name", () => {
    const count = msg`${plural("count", { one: "file", other: "files" })}`;

    expectTypeOf(count).parameter(0).toEqualTypeOf<{ count: number }>();
  });

  it("requires the `other` variant", () => {
    // @ts-expect-error - `other` is the mandatory fallback variant.
    plural("count", { one: "file" });
  });

  it("only allows valid CLDR plural categories", () => {
    // @ts-expect-error - `lots` is not a plural category.
    plural("count", { other: "files", lots: "many" });
  });

  it("rejects a non-number argument", () => {
    const count = msg`${plural("count", { one: "file", other: "files" })}`;

    // @ts-expect-error - `count` must be a number.
    count({ count: "many" });
  });
});
