import { template, $, $default } from "@jack3898/templater";

const text = template`Hello, ${"name"}!`;

console.log(text({ name: "World" }));

const indexed = template`Hello, ${$}! ${$}`;

console.log(indexed(["World", "How are you?"]));

const numText = template`You have ${0} new messages.`;

console.log(numText(["5"]));

const withDefault = template`Hello, ${$}! ${$}`;
const arr = ["World"] as string[] & { [$default]?: string };
arr[$default] = "friend";
console.log(withDefault(arr));
