/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest — they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { plural } from ".";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

describe("plural", () => {
  it("requires the `other` variant", () => {
    // @ts-expect-error - `other` is the mandatory fallback variant.
    plural("count", { one: "file" });
  });

  it("only allows valid CLDR plural categories", () => {
    // @ts-expect-error - `lots` is not a plural category.
    plural("count", { other: "files", lots: "many" });
  });
});
