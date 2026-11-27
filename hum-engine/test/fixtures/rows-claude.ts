import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { parseLooseJson } from "../../src/adapters/marked.ts";
import { type AnsweredHook, answeredHook } from "./ask-hook.ts";
import { SHIM_MODEL } from "./shim.ts";

/**
 * The rig's claude. Claude Code's own checks go to the real claude; a session reads its `--settings` file, takes its
 * `env` as a real session's tools do, fires its hooks as a real session does, and acts out the scenario its run's
 * name names: piping answers to `hum run-answer`, or for a question row, handing its answer hook what the owner picks.
 */
const args = process.argv.slice(2);
const PASSED_ON = ["plugin", "mcp", "config", "--version", "-v", "update", "doctor"];

if (PASSED_ON.includes(args[0] ?? "")) {
	const passed = Bun.spawnSync([process.env.HUM_ROWS_CLAUDE ?? "claude", ...args], { stdio: ["inherit", "inherit", "inherit"] });

	process.exit(passed.exitCode ?? 1);
}

/** What the rig answers a cheap model call hum makes with `claude -p`, by the property its schema asks for: the start check, a kind, an alignment. */
const JUDGMENTS = { ok: { ok: true }, kind: { kind: "docs" }, alignment: { alignment: "sound", verification: "sound" } };

if (args.includes("-p")) {
	const schema = args[args.indexOf("--json-schema") + 1] ?? "";
	const asked = Object.entries(JUDGMENTS).find(([name]) => schema.includes(`"${name}"`));

	appendFileSync(join(process.env.HUM_ROWS_RIG ?? "", "stub-p.log"), `${asked?.[0] ?? `refused: ${args.join(" ")}`}\n`);

	if (asked === undefined) process.exit(1);

	console.log(JSON.stringify({ type: "system", subtype: "init", plugins: [{ name: "hope" }] }));
	console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "", structured_output: asked[1], modelUsage: { [SHIM_MODEL]: { inputTokens: 1, outputTokens: 1 } } }));
	process.exit(0);
}

const Hooks = z.record(z.string(), z.array(z.looseObject({ matcher: z.string().optional(), hooks: z.array(z.looseObject({ command: z.string() })) })));

/** What a hook prints to end the turn it fired in. */
const EndsTurn = z.looseObject({ continue: z.literal(false) });
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

writeFileSync(join(rig, `cwd-${scenario}.txt`), process.cwd());

writeFileSync(join(rig, `key-${scenario}.txt`), env.HUM_RUN_KEY ?? "");

/** Claude Code's question dialog, as its `PermissionRequest` hook reports it. */
const QUESTION = { tool_name: "AskUserQuestion", tool_input: { questions: [{ question: "Which title?", header: "Title", options: [{ label: "a" }, { label: "b" }], multiSelect: false }] } };

/** Fires the hooks settings give `event` whose matcher, where one is set, names the payload's tool; false once one ends the turn. */
const hook = (event: string, payload: Partial<typeof QUESTION> | AnsweredHook = {}): boolean => {
	const input = JSON.stringify({ session_id: session, transcript_path: transcript, hook_event_name: event, cwd: process.cwd(), ...payload });
	const matched = (settings.hooks[event] ?? []).filter(({ matcher }) => matcher === undefined || matcher === payload.tool_name);
	const printed = matched.flatMap((group) => group.hooks.map(({ command }) => Bun.spawnSync(["sh", "-c", command], { env, stdin: Buffer.from(input) }).stdout.toString()));

	return !printed.some((out) => parseLooseJson(EndsTurn, out) !== undefined);
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

/** A question row acts only for an item the rig named, by a file that holds what the owner picks or types; any other waits. One the rig marks unanswered asks and gets no answer. */
const pickFile = join(rig, `go-ask-${env.HUM_RUN?.split(" ")[1] ?? ""}`);

/** What a row the owner talks to hands over, by its step: the order the owner took, the choices shape named, and a pick. */
const TALKED = {
	ideate: { order: { title: "Write the note", ask: "Write docs/note.md.", done: "docs/note.md exists.", limits: ["Change no other file."] } },
	choices: {
		choices: [
			{ title: "a tool", detail: "which tool writes it", role: "find" },
			{ title: "speed", detail: "inline or lazy", role: "spike" },
			{ title: "look", detail: "a card or a banner", role: "draft" },
			{ title: "tone", detail: "plain or warm", pick: "plain" },
		],
	},
	pick: { pick: "the first", found: "the rig measured it" },
};

/** A plan row whose item the rig split: it answers with two parts. */
const SPLIT = {
	event: "needs-split",
	sure: true,
	reason: "Two jobs.",
	parts: [
		{ title: "Write part one", touches: ["docs/one.md"], waitsOn: [], check: "true" },
		{ title: "Write part two", touches: ["docs/two.md"], waitsOn: [1], check: "true" },
	],
};

/** What such a row saves before it asks the owner, which hum must not take. */
const EARLY = {
	ideate: { order: { title: "early", ask: "early", done: "early", limits: [] } },
	choices: { choices: [{ title: "early", detail: "early", pick: "early" }] },
	pick: { pick: "early", found: "early" },
};

/** Marks a moment of a row the owner talks to, by its run's name, in the rig's `talk-rows.jsonl`. */
const mark = (moment: "started" | "answered"): void => appendFileSync(join(rig, "talk-rows.jsonl"), `${JSON.stringify({ run: env.HUM_RUN, moment, at: Date.now(), prepared: existsSync(".hum-prepared") })}\n`);

/**
 * A row the owner talks to: its first turn ends with no answer, as a turn that waits for the owner's words does. Its
 * second saves its early answer before it asks, then asks with Claude Code's question and hands over what its step says.
 */
const talkRow = (step: keyof typeof TALKED) => async (): Promise<void> => {
	mark("started");
	await turn(() => undefined);
	await Bun.sleep(1500);
	await turn(async () => {
		answer(JSON.stringify(EARLY[step]));
		await Bun.sleep(1500);
		hook("PermissionRequest", QUESTION);
		await Bun.sleep(1000);
		answer(JSON.stringify(TALKED[step]));
	});
	mark("answered");
};

const SCENARIOS = new Map<string, () => Promise<void>>(Object.entries({
	ideate: talkRow("ideate"),
	"shape": talkRow("choices"),
	find: talkRow("pick"),
	spike: talkRow("pick"),
	draft: talkRow("pick"),
	plan: async () => undefined,
	"plan-after-talk": async () => {
		if (existsSync(join(rig, `go-split-${env.HUM_RUN?.split(" ")[1] ?? ""}`))) await turn(() => answer(JSON.stringify(SPLIT)));
	},
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
	unasked: async () => {
		await turn(() => answer(DONE));
		await until(() => existsSync(join(env.HUM_RUN_DIR ?? "", "noted")));
		await turn(() => answer(DONE));
	},
	"silent-restart": async () => {
		await turn(() => undefined);
		await until(() => existsSync(join(rig, "go-silent-restart")));
		await turn(() => answer(DONE));
	},
	stopped: async () => undefined,
	ask: async () => {
		if (!existsSync(pickFile)) return;

		const owner = readFileSync(pickFile, "utf8");
		const answers = !existsSync(join(rig, `unanswered-${env.HUM_RUN?.replaceAll(" ", "-") ?? ""}`));

		await turn(async () => {
			/* The row reads its brief first: only an answer hook that matches every tool ends the turn here. */
			if (!hook("PostToolUse", { tool_name: "Read" })) return;

			hook("PostToolUse", answeredHook("early"));
			await Bun.sleep(1500);
			hook("PermissionRequest", QUESTION);
			await Bun.sleep(1000);

			if (answers) hook("PostToolUse", answeredHook(owner));
		});
	},
	restart: async () => {
		await until(() => existsSync(join(rig, "go-restart")));
		await turn(() => answer(DONE));
	},
	build: async () => {
		await until(() => existsSync(join(rig, "go-build")));
		await turn(() => answer(DONE));
	},
}));

hook("SessionStart");

await SCENARIOS.get(scenario)?.();

process.on("SIGHUP", () => process.exit(0));

setInterval(() => {}, 1 << 30);
