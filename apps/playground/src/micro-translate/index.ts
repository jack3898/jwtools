import {
  createTranslationConfig,
  msg,
  ref,
  todo,
} from "@jack3898/micro-translate";
import { num } from "@jack3898/micro-translate/intl/num";

const { define, tool } = createTranslationConfig({
  default: "gb",
  languages: {
    gb: {
      distanceSystem: "METRIC",
    },
    us: {
      distanceSystem: "IMPERIAL",
    },
    au: {
      distanceSystem: "METRIC",
    },
  },
});

const suffix = <const Name extends string>(name: Name) => {
  return tool(name, (_, __, config) => {
    if (config.distanceSystem === "IMPERIAL") {
      return "miles";
    }

    return "kilometers";
  });
};

const translator = define({
  welcome: { gb: "Welcome!", us: ref("gb"), au: todo() },
  carPark: { gb: "Car park", us: "Parking lot", au: todo() },
  complex: {
    gb: msg`You're ${num("distance")} ${suffix("suffix")} away`,
    us: ref("gb"),
    au: todo(),
  },
});

const t = translator("us");

console.log(t.welcome);
console.log(t.carPark);
console.log(t.complex({ distance: 10000 }));
