import { createHash } from "node:crypto";
import { parseArgs } from "node:util";

/**
 * Writes the labelled pairs of the review-note boundary from the owner's own recorded corrections, which no model wrote.
 * Each bullet that quotes the owner ("The owner: "…"") gives a note (the quote) and the rule it became (the bullet's
 * own words). A note and its own rule state one rule: `same`. A note and another bullet's rule, or two notes from
 * different bullets, do not: `different`.
 */

const { values } = parseArgs({ options: { journey: { type: "string" }, out: { type: "string" } } });

if (!values.journey || !values.out) throw new Error("usage: bun scripts/seed-pairs.ts --journey <journey.md> --out <cases.jsonl>");

const text = await Bun.file(values.journey).text();
const digest = createHash("sha256").update(text).digest("hex").slice(0, 12);
const QUOTED = /^- (.+?) The owner: "(.+)"\.?$/;
const PULL_REF = /\(#(\d+)\)/;

type Correction = { readonly pull: string; readonly rule: string; readonly note: string };

let lastPull: string | undefined;

const corrections = text.split("\n").flatMap((line): Correction[] => {
	lastPull = PULL_REF.exec(line)?.[1] ?? lastPull;

	const [, rule, note] = QUOTED.exec(line) ?? [];

	return rule && note && lastPull ? [{ pull: lastPull, rule: rule.replace(/ ?\(#\d+\)\.?/g, "").trim(), note }] : [];
});

if (corrections.length < 2) throw new Error(`${values.journey} holds ${corrections.length} quoted corrections; at least two are needed for a negative pair`);

const source = `journey.md at ${digest}: a quoted note and the rule its own bullet records`;
const pair = (id: string, label: "same" | "different", a: string, b: string) => ({ case: id, label, a: { text: a }, b: { text: b }, labelSource: source });

const cases = corrections.flatMap((own, at) => [
	pair(`pr${own.pull}-own-rule`, "same", own.note, own.rule),
	...corrections.flatMap((other, to) => [
		...(to === at ? [] : [pair(`pr${own.pull}-vs-rule-of-pr${other.pull}`, "different", own.note, other.rule)]),
		...(to > at ? [pair(`pr${own.pull}-vs-note-of-pr${other.pull}`, "different", own.note, other.note)] : []),
	]),
]);

await Bun.write(values.out, `${cases.map((found) => JSON.stringify(found)).join("\n")}\n`);
console.log(`${corrections.length} corrections: ${cases.filter(({ label }) => label === "same").length} same, ${cases.filter(({ label }) => label === "different").length} different`);
