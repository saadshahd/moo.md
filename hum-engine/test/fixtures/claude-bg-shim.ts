import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { shimSpecJson } from "./shim.ts";

/**
 * The background half of the `claude` stand-in: `--bg`, `agents --json`, `stop` and `rm`. A launched run is the
 * stand-in's own `-p` behaviour, run detached from the launch and written the way a background run writes: a
 * transcript of assistant rows then a `structured_output` attachment, and a hook file at the first prompt and at each stop.
 */

const SHIM = join(import.meta.dir, "claude-shim.ts");

const AFTER_ROW_MS = 40;

type Agent = { id: string; kind: "background"; name: string; sessionId: string; cwd: string; state: string; pid: number };

// SAFETY: makeShim wrote the spec file as JSON, with the folder `bg` added.
const spec = JSON.parse(shimSpecJson()) as { bg: string; bgDown?: boolean };

const dir = spec.bg;

const agentsFile = join(dir, "agents.json");

const readAgents = (): Agent[] => {
	try {
		// SAFETY: this file is written only by this shim.
		return JSON.parse(readFileSync(agentsFile, "utf8")) as Agent[];
	} catch {
		return [];
	}
};

const writeAgents = (agents: Agent[]) => {
	mkdirSync(dir, { recursive: true });
	writeFileSync(agentsFile, JSON.stringify(agents));
};

// A stand-in writes whatever shape the test needs; the runner under test parses it.
type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };

type Entry = Record<string, Json | undefined>; // oxlint-disable-line anti-slop/no-unsafe-dictionary-type

const record = (entry: Entry) => {
	mkdirSync(dir, { recursive: true });
	appendFileSync(join(dir, "calls.jsonl"), `${JSON.stringify({ at: Date.now(), ...entry })}\n`);
};

const readLog = (): { cmd: string }[] => {
	try {
		// SAFETY: this file is written only by this shim.
		return readFileSync(join(dir, "calls.jsonl"), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as { cmd: string });
	} catch {
		return [];
	}
};

const valueOf = (argv: string[], flag: string): string => argv[argv.indexOf(flag) + 1] ?? "";

const hookFolder = (settings: string): string => /cat > '(.*?)'\/\$\$\.json/.exec(settings)?.[1] ?? "";

const dropHook = (folder: string, event: string, sessionId: string, transcriptPath: string) => {
	writeFileSync(join(folder, `${process.pid}-${Date.now()}-${event}.json`), JSON.stringify({ hook_event_name: event, session_id: sessionId, transcript_path: transcriptPath }));
};

const setState = (id: string, state: string) => writeAgents(readAgents().map((agent) => (agent.id === id ? { ...agent, state } : agent)));

async function* linesOf(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
	let rest = "";

	const decoder = new TextDecoder();

	for await (const chunk of stream) {
		const parts = (rest + decoder.decode(chunk, { stream: true })).split("\n");

		rest = parts.pop() ?? "";

		yield* parts.filter(Boolean);
	}

	if (rest) yield rest;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const LIMIT_WORDS = /limit/i;

const writeJob = (id: string, tokens: number) => {
	const folder = join(process.env.CLAUDE_CONFIG_DIR ?? "", "jobs", id);

	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, "state.json"), JSON.stringify({ tokens }));
};

const finish = async ([id = "", sessionId = "", cwd = "", folder = "", schema = ""]: string[]) => {
	let resetsAt: number | undefined;
	const transcript = join(dir, `${sessionId}.jsonl`);
	const rows = (row: Entry) => appendFileSync(transcript, `${JSON.stringify({ sessionId, ...row })}\n`);
	const prompt = readFileSync(join(dir, `${id}.prompt`), "utf8");

	writeFileSync(transcript, "");
	dropHook(folder, "UserPromptSubmit", sessionId, transcript);

	const proc = Bun.spawn([process.execPath, SHIM, "-p", "--json-schema", schema, "--session-id", sessionId], { cwd, stdin: new TextEncoder().encode(prompt), stdout: "pipe", env: process.env });

	process.on("SIGTERM", () => {
		proc.kill();
		process.exit(0);
	});

	for await (const line of linesOf(proc.stdout)) {
		const event = JSON.parse(line);

		if (event.type === "job_state") writeJob(id, event.tokens);

		if (event.type === "rate_limit_event") resetsAt = event.rate_limit_info.resetsAt;

		if (event.type === "assistant") rows({ type: "assistant", message: { id: event.message.id, model: "claude-haiku-5-5", usage: event.message.usage } });

		if (event.type !== "result") continue;

		if (event.is_error) {
			rows(
				LIMIT_WORDS.test(event.result)
					? { type: "assistant", isApiErrorMessage: true, error: "rate_limit", quotaLimits: resetsAt === undefined ? undefined : { status: "rejected", resetsAt }, message: { content: [{ type: "text", text: event.result }] } }
					: { type: "assistant", isApiErrorMessage: true, error: event.result },
			);
			setState(id, "failed");

			return;
		}

		dropHook(folder, "Stop", sessionId, transcript);
		await wait(AFTER_ROW_MS);
		rows({ type: "attachment", timestamp: new Date().toISOString(), attachment: { type: "structured_output", data: event.structured_output } });
		await wait(AFTER_ROW_MS);
		dropHook(folder, "Stop", sessionId, transcript);
	}
};

const launch = async (argv: string[]) => {
	const prompt = await Bun.stdin.text();
	const name = valueOf(argv, "-n");
	const settings = valueOf(argv, "--settings");
	const launches = readLog().filter((entry) => entry.cmd === "bg").length;

	record({ cmd: "bg", argv, name, prompt, cwd: process.cwd(), settings });

	if (spec.bgDown) {
		console.error("background service is not running");
		process.exit(1);
	}

	const id = (launches + 1).toString(16).padStart(8, "a");
	const sessionId = `${id}-0000-4000-8000-000000000000`;

	writeFileSync(join(dir, `${id}.prompt`), prompt);

	const child = Bun.spawn([process.execPath, import.meta.path, "finish", id, sessionId, process.cwd(), hookFolder(settings), valueOf(argv, "--json-schema")], {
		cwd: process.cwd(),
		env: process.env,
		stdio: ["ignore", "ignore", "ignore"],
	});

	child.unref();
	writeAgents([...readAgents(), { id, kind: "background", name, sessionId, cwd: process.cwd(), state: "working", pid: child.pid }]);
	console.log(`backgrounded · \x1b[36m${id}\x1b[39m · ${name}`);
};

export const runBackground = async (argv: string[]) => {
	const [first, second] = argv;

	if (first === "agents") {
		console.log(JSON.stringify(readAgents()));

		return;
	}

	if (first === "stop" || first === "rm") {
		record({ cmd: first, id: second });

		const gone = readAgents().find((agent) => agent.id === second);

		if (gone && first === "stop") process.kill(gone.pid, "SIGTERM");

		writeAgents(readAgents().filter((agent) => agent.id !== second));

		return;
	}

	await launch(argv);
};

if (import.meta.main && process.argv[2] === "finish") {
	await finish(process.argv.slice(3));
	process.exit(0);
}

