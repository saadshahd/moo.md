import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ItemId } from "../../src/adapter-api.ts";
import { railRunner, roundupProgram } from "../../src/adapters/rail-rows.ts";
import { SHIPPED_DEFAULTS } from "../../src/config/schema.ts";
import { openState } from "../../src/state/open.ts";
import { RUN_SCHEMA } from "../../src/worker/thin-path.ts";
import { refusing } from "./rows-rig.ts";

/**
 * The rig's program: a Rail rows runner that runs one scenario's run, named for the scenario, and writes its outcome
 * where the test reads it. It then waits, since roundup starts a program that exits again. Stopped, it aborts its run
 * as `hum work` does, and writes that outcome apart, so a second start's outcome is the scenario's result.
 */
const [scenario = "", rig = ""] = process.argv.slice(2);

/** Each scenario's run works in a slot of its own. */
const SLOTS = new Map(Object.entries({ finish: "s1", fix: "s2", keyless: "s3", silent: "s4", stopped: "s5", restart: "s6", "silent-restart": "s7" }));

const state = openState(join(rig, "state"), { now: Date.now });

const abort = new AbortController();

for (const signal of ["SIGTERM", "SIGHUP", "SIGINT"] as const) process.once(signal, () => abort.abort());

const result = async (): Promise<object> => {
	const roundup = await roundupProgram(process.env, state.faults);

	if (!roundup) return { error: `roundup did not take this process as its program: ${JSON.stringify(state.faults.list())}` };

	const runner = railRunner({ call: roundup.call, state, config: { ...SHIPPED_DEFAULTS, backgroundPollSeconds: 0.2, rowNoteWaitSeconds: 60 }, fallback: refusing, now: Date.now });

	const outcome = await runner.run({
		name: `hum 1 ${scenario} #1`,
		item: { id: ItemId.parse("1"), title: "rig item" },
		prompt: `Rig scenario ${scenario}.`,
		cwd: join(rig, "repo", ".hum-slots", SLOTS.get(scenario) ?? "s1"),
		model: "haiku",
		effort: "low",
		schema: RUN_SCHEMA,
		signal: abort.signal,
	});

	return { outcome, faults: state.faults.list() };
};

const outcome = JSON.stringify(await result().catch((error: Error) => ({ error: error.stack ?? error.message })));

if (abort.signal.aborted) {
	writeFileSync(join(rig, `aborted-${scenario}.json`), outcome);
	process.exit(0);
}

writeFileSync(join(rig, `result-${scenario}.json`), outcome);

setInterval(() => {}, 1 << 30);
