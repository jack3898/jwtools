import { describe, expect, it } from "vitest";
import { createTranslationConfig, msg } from ".";
import { num } from "./intl/num";
import { select } from "./select";

describe("select", () => {
  const { define } = createTranslationConfig({
    languages: { "en-GB": {}, "de-DE": {} },
    default: "en-GB",
  });

  const t = define({
    shipped: {
      "en-GB": msg`Your order has shipped${select("tracking", {
        some: msg` with tracking number ${"code"}`,
        none: "",
      })}.`,
      "de-DE": msg`Ihre Bestellung wurde versandt${select("tracking", {
        some: msg` mit Sendungsnummer ${"code"}`,
        none: "",
      })}.`,
    },
    status: {
      "en-GB": msg`Project is ${select("status", { active: "live", archived: "closed" })}`,
      "de-DE": msg`Projekt ist ${select("status", { active: "aktiv", archived: "geschlossen" })}`,
    },
    total: {
      "en-GB": msg`${select("kind", { count: msg`${num("n")} items`, none: "nothing" })}`,
      "de-DE": msg`${select("kind", { count: msg`${num("n")} Artikel`, none: "nichts" })}`,
    },
    fallback: {
      "en-GB": msg`${select("status", { active: "live", other: "unknown" })}`,
      "de-DE": msg`${select("status", { active: "aktiv", other: "unbekannt" })}`,
    },
  });

  it("renders the chosen branch with its parameters", () => {
    expect(
      t("en-GB").shipped({ tracking: { case: "some", code: "1Z999" } }),
    ).toBe("Your order has shipped with tracking number 1Z999.");
  });

  it("renders an empty branch as nothing", () => {
    expect(t("en-GB").shipped({ tracking: { case: "none" } })).toBe(
      "Your order has shipped.",
    );
  });

  it("renders a plain string branch", () => {
    expect(t("en-GB").status({ status: { case: "archived" } })).toBe(
      "Project is closed",
    );
  });

  it("formats nested tools for the active locale", () => {
    expect(t("en-GB").total({ kind: { case: "count", n: 1234567 } })).toBe(
      "1,234,567 items",
    );
    expect(t("de-DE").total({ kind: { case: "count", n: 1234567 } })).toBe(
      "1.234.567 Artikel",
    );
  });

  it("renders `other` for an unmatched case when present", () => {
    expect(t("en-GB").fallback({ status: { case: "deleted" } })).toBe(
      "unknown",
    );
  });

  it("throws a named error for an unmatched case when `other` is absent", () => {
    expect(() =>
      t("en-GB").status({ status: { case: "deleted" as never } }),
    ).toThrow(new Error('select("status") has no branch for "deleted"'));
  });
});
