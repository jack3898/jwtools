import { template, $ } from "@jack3898/templater";

const text = template`Hello, ${"name"}!`;

console.log(text({ name: "World" }));

const indexed = template`Hello, ${$}! ${$}`;

console.log(indexed(["World", "How are you?"]));

const numText = template`You have ${0} new messages.`;

console.log(numText(["5"]));
