// Child process for the background D1 fault test: begin a run, launch it, and die the moment its session id is known, before it is saved.
import { backgroundRunner } from "../../src/adapters/claude-bg.ts";
import { startRunner } from "../../src/adapters/claude-p.ts";
import { SHIPPED_DEFAULTS } from "../../src/config/schema.ts";
import { openState } from "../../src/state/open.ts";

const [dir, binary, name] = process.argv.slice(2);

if (!dir || !binary || !name) throw new Error("usage: launch-and-die.ts <state dir> <claude binary> <run name>");

const state = openState(dir);
const { runner } = await startRunner({ state, model: SHIPPED_DEFAULTS.models.light, binary });
const background = backgroundRunner({ binary, state, config: { ...SHIPPED_DEFAULTS, backgroundPollSeconds: 0.05 }, fallback: runner });

state.runs.begin({ itemId: "#68", run: "build", attempt: 0 }, name);

await background.run({ name, prompt: "do it", cwd: process.cwd(), model: SHIPPED_DEFAULTS.models.light, effort: "low", schema: { type: "object" }, onSession: () => process.kill(process.pid, "SIGKILL") });
