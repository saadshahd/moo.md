import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { stripVTControlCharacters } from "node:util";
import { join } from "node:path";
import { x } from "tinyexec";
import { z } from "zod";
import { startBackgroundRunner } from "../src/adapters/claude-bg.ts";
import type { Runner } from "../src/adapters/claude-p.ts";
import { billedTokens, readTranscript } from "../src/adapters/transcript.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { PROSE_STATES } from "../src/decide/prose.ts";
import { openState } from "../src/state/open.ts";
import { decideProse } from "../src/worker/prose-run.ts";
import { type Checkout, runThinPath } from "../src/worker/thin-path.ts";
import { gitIn } from "../src/adapters/git.ts";
import { markdownAdapter } from "../src/adapters/markdown.ts";
import { configWith } from "./fixtures/config.ts";
import { docsJudge } from "./fixtures/judge.ts";
import { markdownSettings, WorkRepo } from "./fixtures/work-repo.ts";

const repo = process.env.HUM_BG_REPO;
const other = process.env.HUM_BG_OTHER;
const live = process.env.HUM_LIVE === "1" && repo !== undefined && other !== undefined;

if (!live) console.log("skip live background runs: set HUM_LIVE=1, HUM_BG_REPO and HUM_BG_OTHER (two worktrees of one repo whose trust the owner accepted); about nine Haiku runs and one Opus advisor call in the advisor test");

const MODEL = SHIPPED_DEFAULTS.models.light;
const OK_SCHEMA = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] };
const WORD_SCHEMA = { type: "object", properties: { word: { type: "string" } }, required: ["word"] };
const CONFIG = { ...SHIPPED_DEFAULTS, backgroundPollSeconds: 0.5 };
const SLOW_TURN = 'Run `echo one`, then `echo two`, then `echo three`, each as its own separate Bash call, one after another. Then reply {"ok":true}.';
const ADVISOR_TURN = 'Call the advisor tool exactly once (it takes no parameters), then reply {"ok":true}.';
const RUNS_NAMED = "hum live";

const state = openState(mkdtempSync(join(tmpdir(), "hum-live-bg-")));
let runner: Runner;
let check: Awaited<ReturnType<typeof startBackgroundRunner>>["check"];

const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude");

const transcriptOf = (sessionId: string): string => {
	const [path] = [...new Bun.Glob(`projects/*/${sessionId}.jsonl`).scanSync({ cwd: configDir, absolute: true })];

	return readFileSync(path ?? `${sessionId}: no transcript`, "utf8");
};

const Listed = z.array(z.looseObject({ kind: z.string(), name: z.string().nullish() }));

const leftOver = async (): Promise<string[]> =>
	Listed.parse(JSON.parse((await x("claude", ["agents", "--json"])).stdout))
		.filter(({ kind, name }) => kind === "background" && name?.startsWith(RUNS_NAMED))
		.map(({ name }) => name ?? "");

beforeAll(async () => {
	if (!live) return;

	({ check, runner } = await startBackgroundRunner({ state, model: MODEL, config: CONFIG, repo }));
}, 300_000);

afterAll(async () => {
	if (live) expect(await leftOver()).toEqual([]);
});

const ask = (over: Partial<Parameters<Runner["run"]>[0]>) => runner.run({ name: `${RUNS_NAMED} run`, prompt: "", cwd: repo ?? tmpdir(), model: MODEL, effort: "low", schema: OK_SCHEMA, ...over });

test.skipIf(!live)("live: the start check runs one background agent and it leaves a structured_output attachment", () => {
	expect(state.faults.list()).toEqual([]);
	expect(check).toMatchObject({ kind: "finished", structured: { ok: true } });
});

test.skipIf(!live)("live: a plan decision reads its pick from a background run's transcript", async () => {
	const decision = await decideProse({
		purpose: "plan",
		prompt: "Plan adding one line to README.md. The item is clear and small: answer plan-ready with a one-step plan that touches README.md.",
		diff: "",
		model: MODEL,
		run: async (prompt, schema) => {
			const outcome = await ask({ name: `${RUNS_NAMED} decide`, prompt, schema });

			if (outcome.kind !== "finished") throw new Error(`the run ended as ${outcome.kind}`);

			return outcome;
		},
	});

	expect(PROSE_STATES.plan.events.some((event) => event === decision.pick.event)).toBe(true);
	expect(await leftOver()).toEqual([]);
}, 300_000);

test.skipIf(!live)("live: a run past its token cap is stopped partway through its turn and writes nothing after", async () => {
	let sessionId = "";
	const outcome = await ask({ name: `${RUNS_NAMED} cap`, prompt: SLOW_TURN, tokenCap: 1000, onSession: (id) => void (sessionId = id) });

	expect(outcome.kind).toBe("over-cap");

	const stopped = readTranscript(transcriptOf(sessionId));

	await Bun.sleep(5000);

	const later = readTranscript(transcriptOf(sessionId));

	expect(stopped.structured).toBeUndefined();
	expect(Object.keys(later.messages)).toEqual(Object.keys(stopped.messages));
	expect(outcome.kind === "over-cap" && outcome.tokens).toBe(billedTokens(stopped));
	expect(await leftOver()).toEqual([]);
}, 300_000);

test.skipIf(!live)("live: the advisor's tokens ride in the message's iterations and are counted in the run's tokens", async () => {
	let sessionId = "";
	const outcome = await ask({ name: `${RUNS_NAMED} advisor`, prompt: ADVISOR_TURN, onSession: (id) => void (sessionId = id) });
	const rows = transcriptOf(sessionId).split("\n").filter(Boolean);
	const advised = rows.filter((row) => row.includes('"type":"advisor_message"'));

	expect(advised.length).toBeGreaterThan(0);
	expect(outcome.kind === "finished" && outcome.tokens).toBe(billedTokens(readTranscript(rows.join("\n"))));
	expect(outcome.kind === "finished" && outcome.tokens).toBeGreaterThan(40_000);
}, 300_000);

const claude = (cwd: string, args: string[], stdin?: string) => x("claude", args, { stdin, nodePath: false, nodeOptions: { cwd } });

const Sessions = z.array(z.looseObject({ id: z.string().optional(), sessionId: z.string() }));

const sessionOf = async (id: string): Promise<string> => {
	const listed = Sessions.parse(JSON.parse((await claude(tmpdir(), ["agents", "--json"])).stdout));

	return listed.find((agent) => agent.id === id)?.sessionId ?? "";
};

const Word = z.object({ word: z.string() });

/** Whether the run's last structured result holds this word. A resumed run's transcript starts with its source's results. */
const hasWord = (sessionId: string, word: string): boolean => {
	try {
		return Word.safeParse(readTranscript(transcriptOf(sessionId)).structured?.data).data?.word === word;
	} catch {
		return false;
	}
};

const RESULT_READS = 90;

const untilWord = async (sessionId: string, word: string): Promise<void> => {
	for (let reads = 0; reads < RESULT_READS && !hasWord(sessionId, word); reads++) await Bun.sleep(1000);
};

test.skipIf(!live)("live: a stopped background run resumes from another worktree of the same repo, keeping what it was told", async () => {
	const started: string[] = [];

	const launch = async (cwd: string, prompt: string, extra: string[]): Promise<string> => {
		const { stdout } = await claude(cwd, ["--bg", "-n", `${RUNS_NAMED} resume`, "--model", MODEL, "--effort", "low", "--json-schema", JSON.stringify(WORD_SCHEMA), ...extra], prompt);
		const id = /backgrounded\W+([0-9a-f]{8})\b/u.exec(stripVTControlCharacters(stdout))?.[1] ?? "";

		started.push(id);

		return id;
	};

	try {
		const first = await launch(repo ?? "", 'Remember the secret word pineapple-zebra. Reply with JSON {"word":"noted"}.', []);
		const session = await sessionOf(first);

		await untilWord(session, "noted");
		await claude(repo ?? "", ["stop", first]);

		const resumed = await sessionOf(await launch(other ?? "", 'What secret word did I ask you to remember earlier? Reply with JSON {"word":"<that word>"}.', ["--resume", session]));

		await untilWord(resumed, "pineapple-zebra");
		expect(hasWord(resumed, "pineapple-zebra")).toBe(true);
	} finally {
		for (const id of started) {
			await claude(tmpdir(), ["stop", id]);
			await claude(tmpdir(), ["rm", id]);
		}
	}
}, 300_000);

/** The remote's branch as a worktree of the trusted repo: the one place a background run starts. The repo's `origin` is the remote while the run lasts. */
const worktreeOf =
	(trusted: string): Checkout =>
	async (folder, { remote, base }) => {
		const git = gitIn(trusted);

		await git.raw(["remote", "add", "origin", remote]);
		await git.raw(["fetch", "-q", "origin", base]);
		await git.raw(["worktree", "add", "-q", "--detach", folder, "FETCH_HEAD"]);
	};

test.skipIf(!live)("live: the thin path builds an item in a background run started in a worktree of the trusted repo, and the change lands", async () => {
	const trusted = gitIn(repo ?? "");
	const config = configWith((raw) => void (raw.hum.models = { light: MODEL, standard: MODEL, top: MODEL }));
	const work = new WorkRepo();
	const adapter = markdownAdapter({ ...markdownSettings, repo: work.worker("w") }, { report: () => {}, now: Date.now });
	const id = work.add("live-bg-1", "---\ntitle: Write the note\nstate: ready\n---\n\nCreate docs/note.md holding one line: hello. Commit it.\n");
	const before = state.faults.list().length;

	try {
		const result = await runThinPath({
			workSource: adapter.workSource!,
			questions: adapter.questions!,
			state,
			runner,
			config,
			judge: docsJudge,
			remote: work.remote,
			checks: ["test -f docs/note.md"],
			holder: "live",
			workDir: mkdtempSync(join(tmpdir(), "hum-live-bg-work-")),
			checkout: worktreeOf(repo ?? ""),
		});

		expect(result.outcome).toBe("merged");
		expect(state.faults.list()).toHaveLength(before);
		expect(state.runs.list(id).map(({ run, sessionId }) => [run, sessionId?.length])).toEqual([["build", 36]]);
		expect(await leftOver()).toEqual([]);
	} finally {
		await trusted.raw(["worktree", "prune"]);
		await trusted.raw(["remote", "remove", "origin"]);
		await trusted.raw(["for-each-ref", "--format=%(refname:short)", "refs/heads/hum/"]).then((refs) => Promise.all(refs.split("\n").filter(Boolean).map((ref) => trusted.raw(["branch", "-D", ref]))));
		rmSync(work.root, { recursive: true, force: true });
	}
}, 600_000);
