/**
 * Type-level tests for the public type surface.
 *
 * These are not run by Vitest; they are verified by `tsc --noEmit` (the
 * `type-check` target). A failing assertion is a compile error, and a
 * `@ts-expect-error` that *doesn't* error is also a compile error, so the file
 * passing the type-check is the test passing.
 */
import { expectTypeOf } from "expect-type";
import { createTranslationConfig, msg } from ".";
import { num } from "./intl/num";
import { select } from "./select";

// Local no-op harness purely for grouping. The bodies are never executed; `tsc`
// still type-checks them, which is the entire point of this file.
const describe = (_name: string, fn: () => void): void => void fn;
const it = (_name: string, fn: () => void): void => void fn;

type Status = "active" | "paused" | "archived";
declare const status: Status;

describe("select", () => {
  const { define } = createTranslationConfig({
    languages: { "en-GB": {} },
    default: "en-GB",
  });

  const text = define({
    shipped: {
      "en-GB": msg`Your order of ${num("items")} items has shipped${select(
        "tracking",
        {
          some: msg` with tracking number ${"code"}`,
          none: "",
        },
      )}.`,
    },
    status: {
      "en-GB": msg`Project is ${select("status", { active: "live", paused: "on hold", archived: "closed" })}`,
    },
    partial: {
      "en-GB": msg`${select("status", { active: "live", paused: "on hold" })}`,
    },
    fallback: {
      "en-GB": msg`${select("status", { active: "live", other: "unknown" })}`,
    },
  })("en-GB");

  it("accepts each branch with its own parameters and renders a string", () => {
    expectTypeOf(
      text.shipped({ items: 2, tracking: { case: "some", code: "1Z999" } }),
    ).toEqualTypeOf<string>();
    expectTypeOf(
      text.shipped({ items: 2, tracking: { case: "none" } }),
    ).toEqualTypeOf<string>();
    expectTypeOf(
      text.status({ status: { case: "active" } }),
    ).toEqualTypeOf<string>();
  });

  it("accepts a union as the case when every member has a branch", () => {
    expectTypeOf(
      text.status({ status: { case: status } }),
    ).toEqualTypeOf<string>();
  });

  it("rejects an unknown branch", () => {
    // @ts-expect-error - "maybe" is not a branch.
    text.shipped({ items: 2, tracking: { case: "maybe" } });
  });

  it("requires the chosen branch's parameters", () => {
    // @ts-expect-error - `code` is required by "some".
    text.shipped({ items: 2, tracking: { case: "some" } });
  });

  it("rejects parameters belonging to another branch", () => {
    // @ts-expect-error - `code` is not a parameter of "none".
    text.shipped({ items: 2, tracking: { case: "none", code: "x" } });
  });

  it("keeps the outer template's parameters required", () => {
    // @ts-expect-error - `items` is still required.
    text.shipped({ tracking: { case: "none" } });
  });

  it("rejects a branch that renders a rich value", () => {
    // @ts-expect-error - a branch must render a string.
    select("rich", { rich: () => ({ element: true }) });
  });

  it("rejects a union as the case when a member has no branch", () => {
    // @ts-expect-error - "archived" has no branch.
    text.partial({ status: { case: status } });
  });

  it("opens the case to any string when `other` is present", () => {
    expectTypeOf(
      text.fallback({ status: { case: "deleted" } }),
    ).toEqualTypeOf<string>();
    expectTypeOf(
      text.fallback({ status: { case: status } }),
    ).toEqualTypeOf<string>();
  });

  it("restricts `other` to a plain string", () => {
    // @ts-expect-error - `other` cannot be a template.
    select("status", { active: "live", other: msg`${"x"}` });
  });
});
