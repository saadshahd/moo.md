import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { type AnyActor, createActor, createAsyncLogic } from "xstate";
import type { Item, Questions, WorkSource } from "../adapter-api.ts";
import { type ClaudeRunner, succeeded, TIER_MODELS } from "../adapters/claude-p.ts";
import { type Git, HOOKS_OFF, pushHooksOff, runGit } from "../adapters/git.ts";
import { pickTier } from "../config/checks.ts";
import { HUM_RUN_BRANCH_PREFIX } from "../config/change.ts";
import type { Config } from "../config/load.ts";
import { kindMachine } from "../config/machine.ts";
import { type Kind, OWNER_WAIT_TAG, STUCK_TAG } from "../config/schema.ts";
import { persistedSnapshot } from "../state/items.ts";
import type { State } from "../state/open.ts";

/** A run's branch. Not `hum/<id>`: an item named `claim` would clash with the `hum/claim/` claim refs. */
export const runBranch = (id: string): string => `${HUM_RUN_BRANCH_PREFIX}run/${id}`;

/** What the agent run hands back besides its commit. */
export const RUN_SCHEMA = {
	type: "object",
	properties: { status: { enum: ["done", "needs-owner"] }, question: { type: "string" }, plan: { type: "string" } },
	required: ["status"],
} as const;

/** The comment that carries a run's plan on the item's thread, so the next run reads it. */
export const PLAN_MARK = "hum plan:";

export type ThinPathOptions = {
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly state: State;
	/** Started: `runner.start()` has passed. */
	readonly runner: ClaudeRunner;
	readonly config: Config;
	readonly kind: string;
	/** The work repo's remote: a URL or path. Runs clone it; nothing touches the owner's checkout. */
	readonly remote: string;
	readonly base?: string;
	/** The repo's checks as shell commands, run in the clone. All must exit 0. */
	readonly checks: readonly string[];
	readonly holder: string;
	readonly claimTtlMs?: number;
	/** Where runs clone to; a temp folder by default. */
	readonly workDir?: string;
	readonly dir?: string;
	readonly git?: Git;
	/** Runs of the fix role after a failed check, per item. */
	readonly maxFixes?: number;
	/** Take this item; default the first ready one. */
	readonly itemId?: string;
};

export type ThinResult =
	| { readonly outcome: "idle" }
	| { readonly outcome: "lost" | "waiting"; readonly item: string }
	| { readonly outcome: "merged" | "asked" | "stuck" | "review"; readonly item: string; readonly detail?: string }
	| { readonly outcome: "limited"; readonly item: string; readonly until: number }
	| { readonly outcome: "held"; readonly item: string; readonly why: string };

const IDENTITY = { GIT_AUTHOR_NAME: "hum", GIT_AUTHOR_EMAIL: "hum@moo.md", GIT_COMMITTER_NAME: "hum", GIT_COMMITTER_EMAIL: "hum@moo.md" };

const shellOut = async (command: string, cwd: string): Promise<{ code: number; output: string }> => {
	const proc = Bun.spawn(["sh", "-c", command], { cwd, stdout: "pipe", stderr: "pipe", env: process.env });
	const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);

	return { code, output: `${out}${err}` };
};

type Level = { readonly level: string | undefined; readonly unclear: boolean };

/** Row 5, reduced to what the thin path needs: the highest level among the paths a change touches; a path no rule matches is unclear. Slice 9 owns the full rule. */
export const levelOf = (paths: readonly string[], config: Config): Level => {
	const { levels, paths: rules } = config.hum;
	let top = -1;

	for (const path of paths) {
		const matched = rules.filter((rule) => new Bun.Glob(rule.glob).match(path));

		if (matched.length === 0) return { level: undefined, unclear: true };

		top = Math.max(top, ...matched.map((rule) => levels.indexOf(rule.level)));
	}

	return { level: levels[top], unclear: paths.length === 0 };
};

/** Row 7, reduced: a clear change at the lowest level merges. Everything else waits for the review slice 9 adds. */
export const mergeDecision = (level: Level, config: Config): "merge" | "hold" =>
	!level.unclear && level.level === config.hum.levels[0] ? "merge" : "hold";

/** Sets `state: done` in an item file's front matter, so the merged change itself takes the item off the ready list. */
export const markDone = (source: string): string => {
	const lines = source.split("\n");
	const close = lines.indexOf("---", 1);
	const at = lines.findIndex((line, i) => i > 0 && i < close && line.startsWith('state:'));

	if (lines[0] !== "---" || close < 0 || at < 0) throw new Error("item file has no front matter with a state line");

	lines[at] = "state: done";

	return lines.join("\n");
};

type Answered = { readonly question: string; readonly answer: string; readonly plan: string };

/** The question, the answer to it and the plan, once the owner has answered the latest question. */
const answerTo = (item: Item): Answered | undefined => {
	const lastQuestion = item.thread.findLastIndex((e) => e.kind === "question");
	const answer = item.thread.slice(lastQuestion + 1).find((e) => e.kind === "answer");

	if (lastQuestion < 0 || !answer) return undefined;

	const plan = item.thread.findLast((e) => e.kind === "comment" && e.text.startsWith(PLAN_MARK));

	return {
		question: item.thread[lastQuestion]?.text ?? "",
		answer: answer.option ? `${answer.option}: ${answer.text}` : answer.text,
		plan: plan?.text.slice(PLAN_MARK.length).trim() ?? "",
	};
};

const Wants = z.looseObject({ status: z.string().optional(), question: z.string().optional(), plan: z.string().optional() });

const waitsOnOwner = (kind: Kind, value: string): boolean => kind.machine.states[value]?.tags?.includes(OWNER_WAIT_TAG) ?? false;

/** Placeholder sources: enough to restore a snapshot and read its state before the real sources exist. */
const stubSources = (kind: Kind) => {
	const idle = createAsyncLogic({ run: async () => {} });

	return Object.fromEntries(Object.values(kind.machine.states).flatMap((node) => (node.invoke ? [[node.invoke.src, idle]] : [])));
};

/**
 * The thin path (slice 5): a ready markdown item is claimed, built by a `claude -p` run on `hum/run/<id>`,
 * checked by the repo's own checks, and merged in one push that also sets the item's state to done, when its
 * paths are all at the lowest level. A run that needs the owner pushes its branch, asks on the item and
 * ends; the answer starts a fresh run on that branch (Q2). Never `--resume`.
 */
export const runThinPath = async (o: ThinPathOptions): Promise<ThinResult> => {
	const base = o.base ?? "main";
	const kind = o.config.kinds[o.kind];

	if (!kind) throw new Error(`no kind "${o.kind}" in the config`);

	const id = o.itemId ?? (await o.workSource.listReady())[0]?.id;

	if (id === undefined) return { outcome: "idle" };

	const saved = await o.state.items.restore(id, kind, { sources: stubSources(kind) });

	if (!saved.ok) return { outcome: "held", item: id, why: saved.fault.cause };

	const at = saved.value === undefined ? undefined : String(saved.value.getSnapshot().value);

	// A stuck item stays stuck: its file still says ready, and a rerun would spend the same tokens again.
	if (at !== undefined && kind.machine.states[at]?.tags?.includes(STUCK_TAG)) return { outcome: "stuck", item: id };

	const asking = at !== undefined && waitsOnOwner(kind, at);
	const claim = await o.workSource.claim(id, o.holder, o.claimTtlMs ?? 15 * 60_000);

	if (!claim.won) return { outcome: "lost", item: id };

	const item = await o.workSource.read(id);
	const answered = asking ? answerTo(item) : undefined;

	if (asking && !answered) return { outcome: "waiting", item: id };

	const git = o.git ?? runGit;
	const clone = mkdtempSync(join(o.workDir ?? tmpdir(), "hum-run-"));
	const branch = runBranch(id);

	const g = async (args: readonly string[], cwd = clone): Promise<string> => {
		const result = await git([...HOOKS_OFF, ...args], { cwd, env: IDENTITY });

		if (result.code !== 0) throw new Error(`git ${args.join(" ")} failed (${result.code}): ${result.stderr.trim()}`);

		return result.stdout;
	};

	try {
		await g(["clone", "-q", "--branch", base, o.remote, clone], tmpdir());

		if ((await g(["ls-remote", "--heads", "origin", branch])).trim()) {
			await g(["fetch", "-q", "origin", `${branch}:${branch}`]);
			await g(["checkout", "-q", branch]);
		} else {
			await g(["checkout", "-q", "-b", branch]);
		}

		return await drive({ ...o, base, dir: o.dir ?? ".hum/work", kindName: o.kind, kind, id, item, branch, clone, g, git, answered, resume: asking });
	} finally {
		rmSync(clone, { recursive: true, force: true });
	}
};

type Driven = Omit<ThinPathOptions, "kind"> & {
	readonly kindName: string;
	readonly base: string;
	readonly dir: string;
	readonly kind: Kind;
	readonly id: string;
	readonly item: Item;
	readonly branch: string;
	readonly clone: string;
	readonly g: (args: readonly string[], cwd?: string) => Promise<string>;
	readonly git: Git;
	readonly answered: Answered | undefined;
	/** Restore the saved owner-wait snapshot instead of starting the machine. */
	readonly resume: boolean;
};

const drive = async (d: Driven): Promise<ThinResult> => {
	const { state, runner, config, kind, id, item, branch, clone, g, base } = d;
	const maxFixes = d.maxFixes ?? 3;
	const result = Promise.withResolvers<ThinResult>();
	let spent = 0;
	let fixes = 0;
	let lastFailure = "";
	let handled = "";
	let pending: { question: string; plan: string } | undefined;
	let actor: AnyActor;

	const tierFor = (purpose: "build" | "fix") => {
		const row = pickTier(kind, { purpose, level: config.hum.levels[0] ?? "low", size: "small" });

		if (!row) throw new Error(`the ${d.kindName} table has no ${purpose} row`);

		return { model: TIER_MODELS[row.tier], effort: row.effort };
	};

	const prompt = async (purpose: "build" | "fix"): Promise<string> => {
		const role = config.hum.roles[purpose];

		const parts = [
			((role && config.roles[role.file]) ?? "").trim(),
			`# Item ${id}: ${item.title}\n\n${item.body}`,
			`Work on the branch ${branch}. Commit the change when it is whole. End with the JSON {"status":"done"}, or {"status":"needs-owner","question":…,"plan":…} when only the owner can answer.`,
		];

		if (d.answered) {
			const diff = await g(["diff", `origin/${base}...${branch}`]);

			parts.push(
				`## The owner answered\nQuestion: ${d.answered.question}\nAnswer: ${d.answered.answer}\n\n## The plan so far\n${d.answered.plan || "(none saved)"}\n\n## The branch so far\n${diff.slice(0, 100_000)}`,
			);
		}

		if (purpose === "fix") parts.push(`## The checks failed\n${lastFailure.slice(-4000)}\nFix the cause and commit.`);

		return parts.join("\n\n");
	};

	/** Never settles: the driver stops the actor, so the saved snapshot stays at the state it was in. */
	const pause = (outcome: ThinResult): Promise<never> => {
		result.resolve(outcome);

		return new Promise<never>(() => {});
	};

	/** The kinds reach their owner-wait state only through the over-cap event; a run's question uses it too, until slice 11 adds its own. */
	const ask = (question: string, plan: string) => {
		pending = { question, plan };
		actor.send({ type: "token-cap" });
	};

	const step = (purpose: "build" | "fix") =>
		createAsyncLogic({
			run: async ({ signal }) => {
				if (purpose === "fix" && ++fixes > maxFixes) throw new Error(`the checks still fail after ${maxFixes} fixes`);

				const attempt = state.runs.list(id).length;
				const key = { itemId: id, run: purpose, attempt };
				const begun = state.runs.begin(key, `hum ${id} ${purpose} #${attempt}`, crypto.randomUUID());
				const before = (await g(["rev-parse", "HEAD"])).trim();

				const outcome = await runner.run({
					prompt: await prompt(purpose),
					cwd: clone,
					...tierFor(purpose),
					schema: RUN_SCHEMA,
					tokenCap: kind.tokenCap.tokens - spent,
					sessionId: begun.record.sessionId,
					signal,
					onSession: (sessionId) => state.runs.saveSession(key, sessionId),
				});

				if (outcome.kind === "limited") return pause({ outcome: "limited", item: id, until: outcome.until });

				if (outcome.kind === "held") return pause({ outcome: "held", item: id, why: outcome.card.cause });

				if (outcome.kind === "over-cap") {
					spent += outcome.tokens;

					return ask(`The run passed its token cap (${kind.tokenCap.tokens}) at ${outcome.tokens} tokens.`, "");
				}

				spent += outcome.tokens;

				if (!succeeded(outcome)) throw new Error(`the ${purpose} run ended as ${outcome.subtype}: ${outcome.text.slice(0, 300)}`);

				const wants = Wants.safeParse(outcome.structured).data;

				if (wants?.status === "needs-owner") return ask(wants.question ?? "The run needs an answer only you hold.", wants.plan ?? "");

				// R6: done is a new commit on the branch, not the run's word.
				if ((await g(["rev-parse", "HEAD"])).trim() === before) throw new Error(`the ${purpose} run succeeded and committed nothing`);
			},
		});

	const checksSource = createAsyncLogic({
		run: async () => {
			for (const command of d.checks) {
				const ran = await shellOut(command, clone);

				if (ran.code !== 0) {
					lastFailure = `${command} exited ${ran.code}:\n${ran.output}`;
					throw new Error(lastFailure.slice(0, 500));
				}
			}
		},
	});

	const sources = { build: step("build"), checks: checksSource, fix: step("fix") };

	if (d.resume) {
		const restored = await state.items.restore(id, kind, { sources });

		if (!restored.ok) return { outcome: "held", item: id, why: restored.fault.cause };

		if (!restored.value) return { outcome: "held", item: id, why: `the saved state of ${id} vanished` };

		actor = restored.value;
		// The wait it was saved in is already handled; only what follows the answer needs a reaction.
		handled = String(actor.getSnapshot().value);
	} else {
		actor = createActor(kindMachine(kind, sources));
	}

	const react = async (value: string) => {
		if (handled === value) return;

		handled = value;

		if (kind.machine.states[value]?.tags?.includes(STUCK_TAG)) return result.resolve({ outcome: "stuck", item: id });

		if (waitsOnOwner(kind, value)) {
			const note = pending ?? { question: "The run stopped for the owner.", plan: "" };

			await handOff(d, note.question, note.plan);

			return result.resolve({ outcome: "asked", item: id, detail: note.question });
		}

		if (value === "merging") return result.resolve(await merge(d, actor));
	};

	actor.subscribe((snapshot) => {
		const saved = state.items.save(id, kind, persistedSnapshot(actor));

		if (!saved.ok) result.reject(new Error(saved.fault.cause));

		if (snapshot.status === "done") {
			state.items.remove(id);

			return result.resolve({ outcome: "merged", item: id });
		}

		react(String(snapshot.value)).catch((error) => result.reject(error));
	});

	actor.start();

	if (d.answered) actor.send({ type: "answered" });

	return result.promise.finally(() => actor.stop());
};

/** Q2: push the work branch, put the plan and the question on the item, and end. Each write runs once per key (E2). */
const handOff = async (d: Driven, question: string, plan: string) => {
	const { state, id, g, branch, workSource, questions, git, clone } = d;
	const attempt = state.runs.list(id).length;
	const key = (op: string) => ({ itemId: id, run: "ask", attempt, op });

	await state.ops.once(key("push-branch"), {
		holds: async () => (await g(["ls-remote", "--heads", "origin", branch])).startsWith((await g(["rev-parse", "HEAD"])).trim()),
		run: async () => {
			if ((await pushHooksOff(git, clone, ["--force", "origin", `HEAD:refs/heads/${branch}`])) !== "pushed") throw new Error(`could not push ${branch}`);
		},
	});

	if (plan.trim()) {
		await state.ops.once(key("plan"), { holds: async () => false, run: () => workSource.comment(id, `${PLAN_MARK}\n${plan.trim()}`) });
	}

	await state.ops.once(key("question"), { holds: async () => false, run: () => questions.ask(id, { text: question }) });
};

/** Row 7, reduced. Low and clear: one pushed change carries the run's commits and `state: done`. */
const merge = async (d: Driven, actor: AnyActor): Promise<ThinResult> => {
	const { state, config, id, g, base, dir, branch, clone, git } = d;
	const changed = (await g(["diff", "--name-only", `origin/${base}...HEAD`])).split("\n").filter(Boolean);
	const level = levelOf(changed, config);

	if (mergeDecision(level, config) === "hold") {
		return { outcome: "review", item: id, detail: level.unclear ? "a changed path matches no rule" : `level ${level.level}` };
	}

	await state.ops.once(
		{ itemId: id, run: "merge", attempt: 0, op: "push-base" },
		{
			holds: async () => {
				await g(["fetch", "-q", "origin", base]);

				return (await git([...HOOKS_OFF, "merge-base", "--is-ancestor", "HEAD", `origin/${base}`], { cwd: clone })).code === 0;
			},
			run: async () => {
				const file = join(clone, dir, `${id}.md`);

				writeFileSync(file, markDone(readFileSync(file, "utf8")));
				await g(["add", `${dir}/${id}.md`]);
				await g(["commit", "-q", "-m", `hum: finish ${id}`]);

				for (let tries = 0; tries < 3; tries++) {
					await pushHooksOff(git, clone, ["--force", "origin", `HEAD:refs/heads/${branch}`]);

					if ((await pushHooksOff(git, clone, ["origin", `HEAD:refs/heads/${base}`])) === "pushed") return;

					await g(["fetch", "-q", "origin", base]);
					await g(["rebase", "-q", `origin/${base}`]);
				}

				throw new Error(`lost the race to ${base} three times`);
			},
		},
	);

	const sha = (await g(["rev-parse", "HEAD"])).trim();

	state.events.add({ source: "work-source", sourceId: `merged:${sha}`, itemId: id, type: "merged", payload: {} });
	actor.send({ type: "merged" });

	return { outcome: "merged", item: id };
};
