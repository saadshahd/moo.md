import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "./temp.ts";

const SHIM = join(import.meta.dir, "claude-shim.ts");

/** The model id the shim answers as. */
export const SHIM_MODEL = "claude-haiku-5-5";

/** The JSON spec a shim process runs by, from the file HUM_SHIM names: Linux refuses one environment variable over 128 KB, and a spec can hold a longer output. */
export const shimSpecJson = (): string => {
	const file = process.env.HUM_SHIM;

	if (file === undefined) throw new Error("HUM_SHIM names no spec file: start the shim through makeShim");

	return readFileSync(file, "utf8");
};

/** What one `-p` call does. */
export type Behavior = {
	/** Files to write in the working directory, which hum then commits. Without `structured`, the run ends done with a pull request title. */
	write?: Record<string, string>;
	/** Commit what the run wrote as the shim's own commit, as a run told to leave its change uncommitted might. */
	commitsItself?: boolean;
	/** A structured result. */
	structured?: unknown;
	plugins?: string[];
	keySource?: string;
	/** An error result with this text. */
	error?: string;
	/** A rate_limit_event that rejects, with `resetsAt` in epoch seconds. */
	rejectUntil?: number;
	/** The output tokens a background job reports in its state file, whatever its transcript holds. */
	jobTokens?: number;
	/** One assistant message with this many output tokens, then the shim sleeps. */
	spend?: number;
	hang?: boolean;
	modelTokens?: number;
	/** A file the shim writes its stdin to. */
	saveStdin?: string;
	/** A file the shim writes its environment to, as JSON. */
	saveEnv?: string;
	/** A picture of this name the shim saves in the folder for evidence its prompt names. */
	saveEvidence?: string;
	subtype?: string;
	/** Write `docs/<item>.md`, the item being the id in the prompt's `# Item <id>:` heading. Without `structured`, the run ends done with a pull request title. */
	writeForItem?: boolean;
	/** Ask this question until the prompt carries the owner's answer, then finish. */
	askUnlessAnswered?: string;
	/** Sleep this long before the first assistant message. */
	beforeToken?: number;
	/** Sleep this long after it, so the run overlaps another. */
	sleep?: number;
	/** After it, wait until this many runs have written theirs, so the runs overlap; runs that never overlap hang the test. */
	meet?: number;
	/** Write to stderr in the middle of the result line, between two writes of it. */
	stderrNoise?: boolean;
};

/** What a plan or review run picks, as the run's answer. */
export type Decided = { event: string; sure: boolean; reason: string; cites?: { file: string; line: number }[]; parts?: string[]; question?: string; plan?: { summary: string; steps: string[]; paths: string[] } };

/** A plan run's pick of a clear item: write docs/note.md in one step. */
export const READY_PLAN: Decided = { event: "plan-ready", sure: true, reason: "The item is clear.", plan: { summary: "Write the note.", steps: ["Write it."], paths: ["docs/note.md"] } };

export type ShimSpec = { version?: string; script?: Behavior[]; items?: Record<string, Behavior>; decisions?: Decided[]; bgDown?: boolean; agentsWrapped?: boolean; judgmentEnv?: string };

export type Shim = {
	/** The executable the runner calls instead of `claude`. */
	readonly binary: string;
	/** Environment that makes the shim read `spec`. */
	readonly env: Record<string, string>;
	/** One entry per `-p` call, in order. */
	readonly calls: () => { at: number; itemId: string | undefined; argv: string[]; stdinBytes: number; stdinSha: string; pid: number; cwd: string }[];
	/** When each `-p` process wrote its result, by pid. */
	readonly ends: () => { pid: number; at: number }[];
	/** When each `-p` process wrote its first assistant message, by pid. */
	readonly tokens: () => { pid: number; at: number }[];
	/** Each plan or review run: its purpose, the pick it gave, its prompt and its working folder. */
	readonly decisions: () => { purpose: "plan" | "review"; answer: Decided; prompt: string; cwd: string }[];
	/** Each `claude` call that concerns background runs, in order: `bg` launches (with name, prompt and settings), `stop` and `rm`. */
	readonly background: () => { cmd: "bg" | "stop" | "rm"; name?: string; id?: string; prompt?: string; cwd?: string; settings?: string; argv?: string[] }[];
	/** The runs `claude agents --json` lists now. */
	readonly agents: () => { id: string; name: string; sessionId: string; state: string }[];
};

const lines = (file: string) => {
	try {
		return readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
	} catch {
		return [];
	}
};

/** A `claude` stand-in in a temp folder; nothing leaves it. */
export const makeShim = (spec: ShimSpec = {}): Shim => {
	const dir = tempDir("shim");
	const binary = join(dir, "claude");
	const log = join(dir, "calls.jsonl");
	const bg = join(dir, "bg");
	const specFile = join(dir, "spec.json");

	writeFileSync(binary, `#!/bin/sh\nexec bun ${JSON.stringify(SHIM)} "$@"\n`);
	chmodSync(binary, 0o755);
	writeFileSync(specFile, JSON.stringify({ ...spec, log, bg }));

	return {
		binary,
		env: { HUM_SHIM: specFile, CLAUDE_CONFIG_DIR: join(dir, "config") },
		calls: () => lines(log),
		ends: () => lines(`${log}.ends`),
		tokens: () => lines(`${log}.tokens`),
		decisions: () => lines(`${log}.decisions`),
		background: () => lines(join(bg, "calls.jsonl")),
		agents: () => {
			try {
				return JSON.parse(readFileSync(join(bg, "agents.json"), "utf8"));
			} catch {
				return [];
			}
		},
	};
};
