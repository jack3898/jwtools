import { type ToolKey, tool } from "./tool";

type SelectBranch = string | ((dict: never, locale?: string) => string);

/**
 * `other` is restricted to a plain string so the open-ended case it unlocks
 * never needs parameters of its own.
 */
type SelectBranches = Record<string, SelectBranch> & { other?: string };

type BranchParams<Branch> = Branch extends (dict: infer Dict) => string
  ? Dict
  : unknown;

/**
 * The discriminated union a {@link select} parameter accepts: one member per
 * branch, each carrying only that branch's own parameters. With an `other`
 * branch the case is additionally open to any string.
 */
export type SelectValue<Branches extends SelectBranches> =
  | {
      [Case in keyof Branches & string]: { case: Case } & BranchParams<
        Branches[Case]
      >;
    }[keyof Branches & string]
  | ("other" extends keyof Branches ? { case: string & {} } : never);

/**
 * Branches a sentence by a discriminant, like ICU `select`. Each branch is a
 * plain string or a {@link msg} template that renders a string; a template
 * receives the whole select value as its dict and the active locale, so `num`,
 * `date` and `plural` inside a branch format correctly.
 *
 * The parameter is `{ case, ...params }` where `case` is one of the branch
 * names and `params` are that branch's own template parameters. Passing a
 * union or enum as `case` only compiles when every member has a branch.
 *
 * `other` is optional. When present it is rendered for any unmatched case and
 * `case` accepts any string. When absent, an unmatched case throws at runtime.
 *
 * @param name The template parameter name.
 * @param branches The wording per case.
 *
 * @example ```ts
 * msg`Shipped${select("tracking", { some: msg` with tracking number ${"code"}`, none: "" })}.`;
 * // { tracking: { case: "some", code: "1Z999" } } renders "Shipped with tracking number 1Z999."
 * // { tracking: { case: "none" } } renders "Shipped."
 * ```
 */
export function select<
  const Name extends string,
  const Branches extends SelectBranches,
>(name: Name, branches: Branches): ToolKey<Name, SelectValue<Branches>> {
  return tool(name, (value: SelectValue<Branches>, locale) => {
    const branch: SelectBranch | undefined =
      branches[value.case] ?? branches.other;

    if (branch === undefined) {
      throw new Error(
        `select("${name}") has no branch for "${String(value.case)}"`,
      );
    }

    if (typeof branch === "string") {
      return branch;
    }

    // The one correlated-union call. The caller built `value` for exactly this
    // branch, proven at the call site through SelectValue, not carried into a
    // lookup keyed at runtime.
    return (branch as (dict: unknown, locale?: string) => string)(
      value,
      locale,
    );
  });
}
