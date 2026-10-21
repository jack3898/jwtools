import {
  createTranslationConfig,
  msg,
  ref,
  todo,
} from "@jack3898/micro-translate";
import { num } from "@jack3898/micro-translate/intl/num";
import { select } from "@jack3898/micro-translate/select";

const { define, tool } = createTranslationConfig({
  languages: {
    gb: {
      ordinal: { one: "st", two: "nd", few: "rd", other: "th" },
      currency: "GBP",
      distanceSystem: "IMPERIAL",
    },
    us: {
      ordinal: { one: "st", two: "nd", few: "rd", other: "th" },
      currency: "USD",
      distanceSystem: "IMPERIAL",
    },
    ja: {
      ordinal: { other: "番目" },
      currency: "JPY",
      distanceSystem: "METRIC",
    },
    fr: {
      ordinal: { one: "er", other: "e" },
      currency: "EUR",
      distanceSystem: "METRIC",
    },
  },
  default: "gb",
});

function suffix<const Name extends string>(name: Name) {
  return tool(name, (_, __, config) => {
    if (config.distanceSystem === "IMPERIAL") {
      return "miles";
    }

    return "kilometers";
  });
}

function money<const Name extends string>(name: Name) {
  return tool(name, (value: number, locale, { currency }) => {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(value);
  });
}

const translator = define({
  welcome: { gb: "Welcome!", us: ref("gb"), fr: todo(), ja: todo() },
  carPark: { gb: "Car park", us: "Parking lot", fr: todo(), ja: todo() },
  complex: {
    gb: msg`You're ${num("distance")} ${suffix("suffix")} away, ${select(
      "omg",
      {
        some: msg`ok ${"mate"}`,
        none: msg`gg ${"ok"}`,
      },
    )}`,
    us: ref("gb"),
    ja: todo(),
    fr: todo(),
  },
  money: {
    gb: msg`cost ${money("cost")}`,
    fr: msg`cost ${money("cost")}`,
    ja: msg`cost ${money("cost")}`,
    us: msg`cost ${money("cost")}`,
  },
});

const t = translator("ja");

console.log(t.welcome);
console.log(t.carPark);
console.log(t.complex({ distance: 10000, omg: { case: "none", ok: "" } }));
console.log(t.money({ cost: 1234 }));

// Values only known at render time, such as the viewer's currency, come from a
// context declared on the config and handed to the translator with the locale.
const site = createTranslationConfig<{ currency: string }>()({
  languages: { gb: {}, fr: {} },
  default: "gb",
});

function price<const Name extends string>(name: Name) {
  return site.tool(name, (value: number, locale, _config, { currency }) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(
      value,
    ),
  );
}

const siteTranslator = site.define({
  total: {
    gb: msg`Total ${price("amount")}`,
    fr: msg`Total ${price("amount")}`,
  },
});

console.log(siteTranslator("gb", { currency: "GBP" }).total({ amount: 1234 }));
console.log(siteTranslator("fr", { currency: "EUR" }).total({ amount: 1234 }));
