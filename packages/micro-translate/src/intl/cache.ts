export function memoize<Options, Formatter>(
  create: (
    locale: string | undefined,
    options: Options | undefined,
  ) => Formatter,
): (locale: string | undefined, options?: Options) => Formatter {
  const cache = new Map<string, Formatter>();

  return (locale, options) => {
    const key = `${locale ?? ""}:${options ? JSON.stringify(options) : ""}`;
    let formatter = cache.get(key);

    if (!formatter) {
      formatter = create(locale, options);
      cache.set(key, formatter);
    }

    return formatter;
  };
}
