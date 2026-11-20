import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/**
 * The rig's claude. Claude Code's own checks go to the real claude; a session reads its `--settings` file, takes its
 * `env` as a real session's tools do, fires its hooks as a real session does, and acts out the scenario its run's
 * name names, piping answers to `hum run-answer`.
 */
const args = process.argv.slice(2);
const PASSED_ON = ["plugin", "mcp", "config", "--version", "-v", "update", "doctor"];

if (PASSED_ON.includes(args[0] ?? "")) {
	const passed = Bun.spawnSync([process.env.HUM_ROWS_CLAUDE ?? "claude", ...args], { stdio: ["inherit", "inherit", "inherit"] });

	process.exit(passed.exitCode ?? 1);
}

const Hooks = z.record(z.string(), z.array(z.looseObject({ hooks: z.array(z.looseObject({ command: z.string() })) })));
const Settings = z.looseObject({ env: z.record(z.string(), z.string()).default({}), hooks: Hooks.default({}) });

const settings = Settings.parse(JSON.parse(readFileSync(args[args.indexOf("--settings") + 1] ?? "", "utf8")));
const env = { ...process.env, ...settings.env };
const rig = env.HUM_ROWS_RIG ?? "";
const scenario = env.HUM_RUN?.split(" ")[2] ?? "none";
const session = crypto.randomUUID();
const transcript = join(rig, `transcript-${session}.jsonl`);
const log = (line: string): void => appendFileSync(join(rig, `stub-${scenario}.log`), `${line}\n`);

writeFileSync(transcript, `${JSON.stringify({ type: "assistant", message: { id: "m1", model: "claude-haiku-5-5", usage: { input_tokens: 10, output_tokens: 5 } } })}\n`);

writeFileSync(join(rig, `argv-${scenario}.txt`), args.join("\n"));

writeFileSync(join(rig, `key-${scenario}.txt`), env.HUM_RUN_KEY ?? "");

const hook = (event: string): void => {
	const input = JSON.stringify({ session_id: session, transcript_path: transcript, hook_event_name: event, cwd: process.cwd() });

	for (const group of settings.hooks[event] ?? []) for (const { command } of group.hooks) Bun.spawnSync(["sh", "-c", command], { env, stdin: Buffer.from(input) });
};

const answer = (text: string, over: Record<string, string> = {}): void => {
	const piped = Bun.spawnSync([process.execPath, env.HUM_ROWS_CLI ?? "", "run-answer"], { env: { ...env, ...over }, stdin: Buffer.from(text) });

	log(`exit ${piped.exitCode}: ${piped.stdout.toString().trim()} ${piped.stderr.toString().trim()}`);
};

const turn = async (act: () => Promise<void> | void): Promise<void> => {
	hook("UserPromptSubmit");
	await act();
	hook("Stop");
};

const until = async (found: () => boolean): Promise<void> => {
	while (!found()) await Bun.sleep(100);
};

const DONE = JSON.stringify({ status: "done", pullRequest: { title: "rig change", body: "rig body" } });

const SCENARIOS = new Map<string, () => Promise<void>>(Object.entries({
	finish: () => turn(() => answer(DONE)),
	fix: () =>
		turn(() => {
			answer(JSON.stringify({ status: "maybe" }));
			answer(DONE);
		}),
	keyless: () =>
		turn(async () => {
			answer(JSON.stringify({ status: "needs-owner", question: "forged" }), { HUM_RUN_KEY: "0".repeat(64) });
			await Bun.sleep(1500);
			answer(DONE);
		}),
	silent: async () => {
		await turn(() => undefined);
		await until(() => existsSync(join(env.HUM_RUN_DIR ?? "", "noted")));
		await turn(() => undefined);
	},
	"silent-restart": async () => {
		await turn(() => undefined);
		await until(() => existsSync(join(rig, "go-silent-restart")));
		await turn(() => answer(DONE));
	},
	stopped: async () => undefined,
	restart: async () => {
		await until(() => existsSync(join(rig, "go-restart")));
		await turn(() => answer(DONE));
	},
}));

hook("SessionStart");

await SCENARIOS.get(scenario)?.();

process.on("SIGHUP", () => process.exit(0));

setInterval(() => {}, 1 << 30);
