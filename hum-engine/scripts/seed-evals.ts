import { z } from "zod";
import { gitIn } from "../src/adapters/git.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";

/**
 * Writes the labelled cases of three model-judgment boundaries, each from a label source no model wrote:
 * kind from the conventional-commit type of the base's own history, the plan outcome and the review verdict by
 * construction; and the alignment set's sample with its diffs, from the cases `scripts/replay.ts` labelled.
 */

const PER_KIND = 8;

const KIND_OF_TYPE = { feat: "feature", fix: "fix", docs: "docs" } as const;

const CONVENTIONAL = /^(feat|fix|docs)(\([^)]*\))?!?:\s*(.+)$/;

const git = gitIn(".");
const head = (await git.raw(["rev-parse", "main"])).trim();
const log = (await git.raw(["log", "main", "--no-merges", "--format=%H%x1f%s%x1f%b%x1e"])).split("\x1e").map((entry) => entry.trim().split("\x1f"));

const kindCases = Object.entries(KIND_OF_TYPE).flatMap(([type, kind]) =>
	log
		.flatMap(([sha, subject, body]) => {
			const match = CONVENTIONAL.exec(subject ?? "");

			return match?.[1] === type && sha ? [{ case: sha, label: kind, title: match[3], body: (body ?? "").slice(0, 600), labelSource: `conventional-commit type of commit ${sha.slice(0, 12)} on main at ${head.slice(0, 12)}, its prefix stripped` }] : [];
		})
		.slice(0, PER_KIND),
);

const READY = [
	"Add a --version flag to the CLI in src/cli.ts. It prints the version from package.json and exits 0.",
	"Fix the typo 'recieve' in README.md: it should read 'receive'.",
	"Add a unit test for clamp in src/limits.ts covering a value below, inside and above the range.",
	"Rename the helper fmtDate to formatDate in src/dates.ts and update its caller in src/cli.ts.",
];

const UNRELATED = ["Move the CI from Travis to GitHub Actions.", "Add a dark mode to the settings page.", "Migrate the database from MySQL to Postgres.", "Write a blog post announcing the 2.0 release."];

const BLOCKED = [
	"Deploy the app to our production server. Its address and credentials are not in the repo.",
	"Change the pricing table in README.md to show the new prices.",
	"Make the CLI's banner red. Also make the same banner blue.",
	"Email the weekly report to the client's address.",
];

const constructed = "constructed: a self-contained item is ready; two unrelated ready items joined need a split; an item that needs a fact or choice only the owner holds is blocked";

const planCases = [
	...READY.map((body, index) => ({ case: `ready-${index + 1}`, label: "plan-ready", body })),
	...READY.map((body, index) => ({ case: `split-${index + 1}`, label: "needs-split", body: `${body}\n\nSeparately: ${UNRELATED[index]}` })),
	...BLOCKED.map((body, index) => ({ case: `blocked-${index + 1}`, label: "plan-blocked", body })),
].map((found) => ({ ...found, labelSource: constructed }));

/** A change that adds one file, in unified diff form. */
const newFile = (file: string, lines: readonly string[]): string =>
	[`diff --git a/${file} b/${file}`, "new file mode 100644", "--- /dev/null", `+++ b/${file}`, `@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`), ""].join("\n");

const PAIRS = [
	{ file: "src/math.ts", item: "Add a function that returns the sum of two numbers.", lines: ["/** The sum of two numbers. */", "export const add = (a: number, b: number): number => a + b;"], bad: { line: 2, text: "export const add = (a: number, b: number): number => a - b;" } },
	{ file: "src/greet.ts", item: 'Greet a user by name: greet("Ada") returns "Hello, Ada!".', lines: ["/** A greeting for one person. */", "export const greet = (name: string): string => `Hello, ${name}!`;"], bad: { line: 2, text: 'export const greet = (name: string): string => "Hello, world!";' } },
	{ file: "src/limits.ts", item: "Clamp a value between a minimum and a maximum.", lines: ["/** The value, kept between min and max. */", "export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));"], bad: { line: 2, text: "export const clamp = (value: number, min: number, max: number): number => Math.max(max, Math.min(min, value));" } },
	{ file: "src/list.ts", item: "Return the last item of a list, or undefined for an empty list.", lines: ["/** The last item, if any. */", "export const last = <T>(items: readonly T[]): T | undefined => items[items.length - 1];"], bad: { line: 2, text: "export const last = <T>(items: readonly T[]): T | undefined => items[items.length];" } },
	{ file: "src/port.ts", item: "Read the port from the PORT variable, defaulting to 3000.", lines: ["/** The port to listen on. */", "export const port = (env: Record<string, string | undefined>): number => Number(env.PORT ?? 3000);"], bad: { line: 2, text: "export const port = (env: Record<string, string | undefined>): number => 3000;" } },
	{ file: "docs/install.md", item: "Document how to install the CLI with bun.", lines: ["# Install", "", "Run `bun add -g @acme/cli`, then `acme --help`."], bad: { line: 3, text: "Run `pip install acme-cli`, then `acme --help`." } },
];

const mutation = "constructed by mutation: the change as asked is approved; one line made wrong asks for changes citing that line";

const reviewCases = PAIRS.flatMap(({ file, item, lines, bad }) => [
	{ case: `${file}#as-asked`, label: "approve", item, diff: newFile(file, lines), labelSource: mutation },
	{ case: `${file}#line-${bad.line}`, label: "request-changes", item, diff: newFile(file, lines.map((line, index) => (index + 1 === bad.line ? bad.text : line))), cite: { file, line: bad.line }, labelSource: mutation },
]);

const write = (boundary: string, cases: readonly object[], file = "cases.jsonl") => Bun.write(`evals/${boundary}/${file}`, `${cases.map((found) => JSON.stringify(found)).join("\n")}\n`);

await Promise.all([write("kind", kindCases), write("plan-outcome", planCases), write("review-verdict", reviewCases)]);
console.log(`kind ${kindCases.length}, plan-outcome ${planCases.length}, review-verdict ${reviewCases.length} cases written`);

const PER_ALIGNMENT_LABEL = 10;

const AlignmentCase = z.object({ case: z.string(), label: z.string() }).loose();

/** The alignment set's measured sample, each case with its diff, so the set reruns where the base's history is absent. */
const alignment = (await Bun.file("evals/alignment/cases.jsonl").text())
	.split("\n")
	.filter(Boolean)
	.map((line) => AlignmentCase.parse(JSON.parse(line)));

const sample = [...alignment.filter((found) => found.label === "clean").slice(0, PER_ALIGNMENT_LABEL), ...alignment.filter((found) => found.label !== "clean").slice(0, PER_ALIGNMENT_LABEL)];
const withDiffs = await Promise.all(sample.map(async (found) => ({ ...found, diff: (await git.raw(["show", "--format=", "--patch", found.case])).slice(0, SHIPPED_DEFAULTS.diffLimit) })));

await write("alignment", withDiffs, "sample.jsonl");
console.log(`alignment sample ${withDiffs.length} cases written with their diffs`);
