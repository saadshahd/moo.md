import { parseArgs } from "node:util";
import { gitIn } from "../src/adapters/git.ts";
import { readHistory } from "../src/adapters/history.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { labelChanges, matchedSample } from "../src/decide/labels.ts";

const { values } = parseArgs({ options: { repo: { type: "string" }, base: { type: "string", default: "main" }, out: { type: "string" } } });

if (!values.repo || !values.out) throw new Error("usage: bun scripts/replay.ts --repo <path> [--base main] --out <cases.jsonl>");

const git = gitIn(values.repo, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });
const head = (await git.raw(["rev-parse", values.base])).trim();
const changes = await readHistory(git, head, { ...SHIPPED_DEFAULTS, historyDepth: 2 ** 31 - 1 });
const labels = labelChanges(changes, SHIPPED_DEFAULTS.changeLabels);
const sample = matchedSample(changes, labels);
const source = `git history of ${values.base} at ${head.slice(0, 12)}: revert trailers and titles, fix commits that name a change or rewrite its lines`;
const lines = sample.map((change) => JSON.stringify({ case: change.sha, label: labels.get(change.sha), subject: change.subject, files: change.files, size: change.size, labelSource: source }));
const count = (label: string) => [...labels.values()].filter((found) => found === label).length;

await Bun.write(values.out, `${lines.join("\n")}\n`);
console.log(`${changes.length} changes: ${count("reverted")} reverted, ${count("fixed")} fixed, ${count("clean")} clean; ${sample.length} cases written`);
