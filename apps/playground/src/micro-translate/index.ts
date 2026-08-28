import {
  createTranslationConfig,
  msg,
  ref,
  todo,
} from "@jack3898/micro-translate";
import { num } from "@jack3898/micro-translate/intl/num";

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
    gb: msg`You're ${num("distance")} ${suffix("suffix")} away`,
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
console.log(t.complex({ distance: 10000 }));
console.log(t.money({ cost: 1234 }));
