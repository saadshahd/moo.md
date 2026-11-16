// Child process for the item log's kill test: one plan run of one item, killed with SIGKILL at a chosen point.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openState } from "../../src/index.ts";
import { answerOnce } from "../../src/state/item-log.ts";
import { finished } from "./answers.ts";

const [dir, mode] = process.argv.slice(2);

if (!dir || !mode) throw new Error("usage: kill-answer.ts <state dir> <before-run|after-run|after-log|after-end|finish>");

/** Where the model leaves its answer, as a run's transcript keeps it: one line per time the model was asked. */
const transcript = join(dir, "transcript.txt");
const kill = () => process.kill(process.pid, "SIGKILL");
const state = openState(dir, { now: Date.now });
const key = state.runs.keyFor("#68", "plan");

const { begun } = await answerOnce(state, { key, launch: { name: `hum #68 plan #${key.attempt}` }, question: { prompt: "Plan the change." } }, async ({ adopted }) => {
	if (mode === "before-run") kill();

	// An adopted run whose transcript holds its answer is read, never asked again.
	if (!(adopted && existsSync(transcript))) appendFileSync(transcript, `${JSON.stringify(finished({ event: "plan-ready" }))}\n`);

	if (mode === "after-run") kill();

	return JSON.parse(readFileSync(transcript, "utf8").split("\n")[0] ?? "");
});

if (mode === "after-log") kill();

begun.end();

if (mode === "after-end") kill();
