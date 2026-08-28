import { createTranslationConfig, msg } from "@jack3898/micro-translate";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { define, tool } = createTranslationConfig({
  languages: {
    en: { termsLabel: "the terms" },
    ja: { termsLabel: "利用規約" },
    de: { termsLabel: "die AGB" },
  },
  default: "en",
});

// The wrapped text lives in the translation via per-locale config; the markup
// comes from the call site.
function wrap<const Name extends string>(name: Name, text: string) {
  return tool(name, (render: (text: string) => ReactNode) => render(text));
}

// Or read the wrapped text from per-locale config instead of the template.
function terms<const Name extends string>(name: Name) {
  return tool(name, (render: (text: string) => ReactNode, _locale, config) =>
    render(config.termsLabel),
  );
}

const translator = define({
  accept: {
    en: msg`Read ${terms("terms")} before continuing`,
    ja: msg`続行する前に${terms("terms")}をお読みください`,
    de: msg`Lies ${terms("terms")}, bevor du fortfährst`,
  },
  greeting: {
    en: msg`Hi ${"name"}, you have ${wrap("count", "new messages")}`,
    ja: msg`${"name"}さん、${wrap("count", "新着メッセージ")}があります`,
    de: msg`Hallo ${"name"}, du hast ${wrap("count", "neue Nachrichten")}`,
  },
  plain: {
    en: "No templates here, still a plain string",
    ja: "テンプレートなし、ただの文字列",
    de: "Keine Templates, nur ein String",
  },
});

function AcceptNotice({ locale }: { locale: "en" | "ja" | "de" }) {
  const t = translator(locale);

  return (
    <div>
      {/* The key silences React's dev warning about element chunks in an array. */}
      <p>
        {t.accept({
          terms: (text) => (
            <a key="terms" href="/terms">
              {text}
            </a>
          ),
        })}
      </p>
      <p>
        {t.greeting({
          name: "Ada",
          count: (text) => <strong key="count">{text}</strong>,
        })}
      </p>
      <p>{t.plain}</p>
    </div>
  );
}

for (const locale of ["en", "ja", "de"] as const) {
  console.log(`--- ${locale} ---`);
  console.log(renderToStaticMarkup(<AcceptNotice locale={locale} />));
}

// Out is not tied to React. The same mechanism with a custom element type,
// showing the raw chunk array a framework renderer would receive:
type El = { tag: string; text: string };

const rawTerms = <const Name extends string>(name: Name) =>
  tool(name, (render: (text: string) => El, _locale, config) =>
    render(config.termsLabel),
  );

const rawTranslator = define({
  accept: {
    en: msg`Read ${rawTerms("terms")} before continuing`,
    ja: msg`続行する前に${rawTerms("terms")}をお読みください`,
    de: msg`Lies ${rawTerms("terms")}, bevor du fortfährst`,
  },
});

console.log("--- raw chunks (en) ---");
console.log(
  rawTranslator("en").accept({ terms: (text) => ({ tag: "a", text }) }),
);
