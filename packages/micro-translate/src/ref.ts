const refBrand = Symbol("micro-translate/ref");

/**
 * The callback both markers expose: given the config's `default` locale, it
 * returns the sibling locale to forward to. {@link ref} ignores the default and
 * returns its fixed target; {@link todo} returns the default itself. Resolving a
 * marker means calling it — the translator passes in `config.default`.
 */
type RefCallback = (defaultLocale: string) => string;

/**
 * A branded callback produced by {@link ref}. Forwards a locale entry to a
 * sibling locale's value within the same translation key, resolved lazily on
 * property access by invoking the callback.
 */
export type Ref<Target extends string = string> = RefCallback & {
  [refBrand]: true;
  target: Target;
  wasTodo: false;
};

/**
 * A branded callback produced by {@link todo} — a {@link Ref} that defers its
 * target to the config's `default` (which it can't know up front), so it shares
 * the brand and every `ref` rule applies to it automatically. `wasTodo` only
 * sharpens the runtime guard's message and never participates in validation.
 */
export type TodoRef = RefCallback & {
  [refBrand]: true;
  wasTodo: true;
};

export type AnyRef = Ref | TodoRef;

/**
 * Forwards this locale's entry to another locale's value within the same
 * translation key — as if the target field were copied and pasted into place.
 * For deliberate, character-for-character identical translations.
 *
 * The target must be another locale key in the same key's object, and must not
 * itself be a `ref(...)`/`todo()` — both are enforced at compile time and
 * guarded at runtime.
 *
 * @example ```ts
 * define({
 *   submit: {
 *     en: "Submit",
 *     "en-gb": ref("en"), // identical to English
 *   },
 * });
 * ```
 *
 * @param target The sibling locale whose value to forward to
 */
export function ref<const Target extends string>(target: Target): Ref<Target> {
  return Object.assign((_defaultLocale: string) => target, {
    [refBrand]: true as const,
    target,
    wasTodo: false as const,
  });
}

/**
 * Stubs an untranslated entry. A thin wrapper over {@link ref}: at resolve time
 * it forwards to `ref(<default>)`, deferring the target to the config's
 * `default`. Resolves to the default locale's value for that key, and because it
 * carries the same brand, every `ref` rule applies to it automatically.
 *
 * Enables gap-free incremental localization: add a locale, stub each missing
 * entry with `todo()` (the app compiles and ships on the default-locale
 * fallback), then replace each with a real template at your own pace.
 * `grep -rn 'todo()' src/` is your exact backlog.
 *
 * @example ```ts
 * define({ welcome: { en: msg`Hi`, fr: todo() } }); // fr falls back to the default
 * ```
 */
export function todo(): TodoRef {
  return Object.assign(
    (defaultLocale: string) => ref(defaultLocale)(defaultLocale),
    { [refBrand]: true as const, wasTodo: true as const },
  );
}

export function isRef(value: unknown): value is AnyRef {
  return (
    (typeof value === "function" || typeof value === "object") &&
    value !== null &&
    refBrand in value
  );
}
