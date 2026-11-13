import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ADAPTER_API_VERSION, type Item, ItemId, type Questions, type WorkSource } from "../adapter-api.ts";
import { type Git, gitIn, push } from "../adapters/git.ts";
import type { GitHubCommits } from "../adapters/github-commits.ts";
import type { ModelCall } from "../adapters/model-call.ts";
import { onceCalls } from "../adapters/once.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";
import type { Config } from "../config/load.ts";
import { commandTimeoutMs } from "../exec.ts";
import type { State } from "../state/open.ts";
import { evidenceRef } from "../worker/evidence.ts";
import { land, type LandContext, prepareLanding, unpushed } from "../worker/land.ts";
import { releaseQuestions, roomToday } from "../worker/questions.ts";
import { pushRunBranch, signsCommits } from "../worker/signed-push.ts";
import { claimTtlMs, runBranch, type ThinResult } from "../worker/thin-path.ts";
import { type BundleCheck, type BundleRefs, checkBundle, OUTBOX_REFS } from "./bundle.ts";
import type { Intent } from "./intents.ts";
import { MEGABYTE } from "../bytes.ts";

type Scope = { readonly run: string; readonly attempt: number };

/** Applies one kind of intent; a result ends the pass's publish with it. */
type Appliers = { readonly [K in Intent["kind"]]: (intent: Extract<Intent, { kind: K }>) => Promise<ThinResult | undefined> };

/**
 * The order publish applies a pass's intents in: the change first, so a work source that keeps its threads on the
 * base, as markdown does, moves the base only after the change landed on the base the pass checked it on.
 */
const APPLY_ORDER: readonly Intent["kind"][] = ["keep-evidence", "push-branch", "save-landing", "land", "file-follow-up", "comment", "decide"];

/** What gather saw for a pass, which publish checks the pass's bundle against: the base commit and each hum branch at its head. */
export type GatherTrust = { readonly baseSha: string; readonly heads: Readonly<Record<string, string>> };

/** One pass's outbox: its item, its intents in order, and the bundle of the refs it made, absent when it made none. */
export type PassOutbox = { readonly item: string; readonly intents: readonly Intent[]; readonly bundle: string | undefined };

/** Everything publish reads and writes. It runs none of the repo's code, and its model calls use no tool. */
export type Publisher = {
	readonly state: State;
	readonly config: Config;
	readonly workSource: WorkSource;
	readonly questions: Questions;
	readonly pulls: PullRequests | undefined;
	readonly commits: GitHubCommits | undefined;
	readonly judge: ModelCall;
	/** A review of a change from its item and diff alone, for a level that asks for one. */
	readonly reviewRun: (item: Item, kind: string) => LandContext["reviewRun"];
	/** The item's kind from what publish trusts: its labels, or the kind gather saved. */
	readonly kindOf: (item: Item) => string;
	readonly holder: Parameters<WorkSource["claim"]>[1];
	readonly now: () => number;
	/** The remote's URL or path. */
	readonly remote: string;
	readonly base: string;
	/** The items folder, where a markdown item's file is marked done. */
	readonly dir: string;
	/** Publish's own repo: the remote's objects and each pass's bundle; no work tree of it runs anything. */
	readonly repo: string;
	/** The time past which publish starts no merge: its GitHub token's hour less `ciMergeMarginMinutes`; unset on a Mac. */
	readonly mergesBefore?: number;
};

const timeoutOf = (p: Pick<Publisher, "config">): number => commandTimeoutMs(p.config.hum);

/** Publish's repo, made on first use, with the remote as `origin`. */
export const openPublishRepo = async (p: Pick<Publisher, "repo" | "remote" | "config">): Promise<Git> => {
	const git = gitIn(p.repo, { identity: p.config.hum.commitIdentity, timeoutMs: timeoutOf(p) });

	if (existsSync(join(p.repo, ".git"))) return git;

	mkdirSync(p.repo, { recursive: true });
	await git.raw(["init", "-q"]);
	await git.raw(["remote", "add", "origin", p.remote]);

	return git;
};

/** Publish's repo with the remote's base, as `origin/<base>`, and the commits `heads` fetched into it. */
export const fetchedPublishRepo = async (p: Pick<Publisher, "repo" | "remote" | "config" | "base">, heads: readonly string[] = []): Promise<Git> => {
	const git = await openPublishRepo(p);

	await git.raw(["fetch", "-q", "origin", `+refs/heads/${p.base}:refs/remotes/origin/${p.base}`, ...heads]);

	return git;
};

/** A worktree of publish's repo at `ref`, on `branch`, removed after `use`. Checking files out runs no hook and no filter of the repo. */
const onBranch = async <T>(git: Git, p: Publisher, { ref, branch }: { readonly ref: string; readonly branch: string }, use: (worktree: { readonly git: Git; readonly folder: string }) => Promise<T>): Promise<T> => {
	const folder = mkdtempSync(join(tmpdir(), "hum-publish-"));

	await git.raw(["worktree", "add", "-q", "-B", branch, folder, ref]);

	try {
		return await use({ git: gitIn(folder, { identity: p.config.hum.commitIdentity, timeoutMs: timeoutOf(p) }), folder });
	} finally {
		await git.run(["worktree", "remove", "--force", folder]);
		await git.run(["branch", "-D", branch]);
		rmSync(folder, { recursive: true, force: true });
	}
};

const outboxRef = (ref: string): string => `${OUTBOX_REFS}${ref.slice("refs/".length)}`;

const landContext = (p: Publisher, item: Item, { git, folder }: { readonly git: Git; readonly folder: string }, branch: string): LandContext => ({
	state: p.state,
	config: p.config,
	kind: p.kindOf(item),
	id: item.id,
	item,
	branch,
	base: p.base,
	remote: p.remote,
	clone: folder,
	dir: p.dir,
	git,
	workSource: p.workSource,
	questions: p.questions,
	pulls: p.pulls,
	commits: p.commits,
	now: p.now,
	judge: p.judge,
	reviewRun: p.reviewRun(item, p.kindOf(item)),
	mergesBefore: p.mergesBefore,
});

const NOTHING_BUNDLED: BundleCheck = { ok: true, refs: new Map() };

/** A pass publish refused before any write, and why. */
export const refusedPass = (item: string, why: string): ThinResult => ({ outcome: "stuck", item, detail: `publish refused the pass: ${why}` });

/** The bytes of every file the tree at `commit` holds, which a worktree of it writes to disk. */
const treeBytes = async (git: Git, commit: string): Promise<number> =>
	(await git.raw(["ls-tree", "-r", "-l", commit])).split("\n").reduce((total, line) => total + (Number(line.split(/\s+/)[3]) || 0), 0);

type PassCheck = { readonly p: Publisher; readonly git: Git; readonly trust: GatherTrust; readonly pass: PassOutbox; readonly refs: BundleRefs; readonly branch: string };

/**
 * Why publish refuses a pass whose bundle passed, before any write: an intent names a head that is neither its
 * bundle's tip of the item's run branch, gather's base, nor that branch's head as gather saw it; it keeps evidence
 * its bundle does not hold; it files more follow-ups than `followUpsPerPass` and the daily question cap leave room
 * for; or a head's tree is larger than `publishTreeMaxMegabytes`.
 */
const passFault = async ({ p, git, trust, pass, refs, branch }: PassCheck): Promise<string | undefined> => {
	const heads = [...new Set(pass.intents.flatMap((intent) => ("head" in intent ? [intent.head] : [])))];
	const known = new Set([refs.get(`refs/heads/${branch}`), trust.baseSha, trust.heads[branch]]);
	const stranger = heads.find((head) => !known.has(head));

	if (stranger !== undefined) return `it names ${stranger} as the head of ${branch}, which is neither its bundle's tip, the base gather saw, nor the head gather saw for ${branch}`;

	const evidence = evidenceRef(pass.item);

	if (pass.intents.some(({ kind }) => kind === "keep-evidence") && !refs.has(evidence)) return `it asks to keep evidence its bundle does not hold on ${evidence}`;

	const followUps = pass.intents.filter(({ kind }) => kind === "file-follow-up").length;
	const room = Math.min(p.config.hum.followUpsPerPass, roomToday(p));

	if (followUps > room) return `it files ${followUps} follow-ups, and followUpsPerPass and the daily question cap leave room for ${room}`;

	const cap = p.config.hum.publishTreeMaxMegabytes * MEGABYTE;

	for (const head of heads) {
		const bytes = await treeBytes(git, head);

		if (bytes > cap) return `the tree at ${head} holds ${bytes} bytes, over publishTreeMaxMegabytes (${p.config.hum.publishTreeMaxMegabytes})`;
	}

	return undefined;
};

/**
 * Applies one pass's outbox: the bundle must pass every check and the pass every check of its intents, before any
 * write; then the claim must still be the worker's, each intent runs in order under its op key, and the questions the
 * daily cap has room for go out. A landing's result is the pass's result; nothing else decides the item.
 */
export const publishPass = async (p: Publisher, trust: GatherTrust, pass: PassOutbox): Promise<ThinResult | undefined> => {
	const id = ItemId.parse(pass.item);
	const heads = Object.values(trust.heads);
	const git = await fetchedPublishRepo(p, heads);
	const branch = runBranch(p.config.hum, pass.item);

	const checked = pass.bundle === undefined ? NOTHING_BUNDLED : await checkBundle(git, pass.bundle, {
		base: trust.baseSha,
		heads,
		identity: p.config.hum.commitIdentity,
		branchPrefixes: [p.config.hum.runBranchPrefix, p.config.hum.ownerBranchPrefix],
		signs: await signsCommits({ pulls: p.pulls, base: p.base }),
	});

	if (!checked.ok) return refusedPass(pass.item, checked.why);

	const fault = await passFault({ p, git, trust, pass, refs: checked.refs, branch });

	if (fault !== undefined) return refusedPass(pass.item, fault);

	if (!(await p.workSource.renew(id, p.holder, claimTtlMs(p.config))).won) return { outcome: "lost", item: pass.item };

	const calls = (scope: Scope) => onceCalls({ apiVersion: ADAPTER_API_VERSION, workSource: p.workSource, questions: p.questions }, p.state.ops, scope);
	const item = await p.workSource.read(id);
	const onRunBranch = (head: string) => ({ ref: head, branch });

	/** Saves the change on the run branch as the item's landing, then goes on with it. */
	const landing = (head: string, then: (ctx: LandContext) => Promise<ThinResult | undefined>) =>
		onBranch(git, p, onRunBranch(head), async (worktree) => {
			const ctx = landContext(p, item, worktree, branch);
			const pushed = await prepareLanding(ctx);

			return pushed.kind === "pushed" ? then(ctx) : unpushed(pass.item, branch, pushed);
		});

	const apply = {
		comment: async ({ text, scope }) => void (await calls(scope).workSource?.comment(id, text)),
		decide: async ({ text, scope }) => void (await calls(scope).questions?.decide(id, text)),
		"file-follow-up": async ({ title, body }) => {
			const filed = await p.workSource.fileFollowUp(id, { title, body });

			p.state.followUps.put(filed.id, { item: filed.id, from: pass.item, at: p.now() });

			return undefined;
		},
		"keep-evidence": async () => {
			const ref = evidenceRef(pass.item);
			const pushed = await push(git, ["--force", "origin", `${outboxRef(ref)}:${ref}`]);

			return pushed.kind === "refused" ? unpushed(pass.item, ref, pushed) : undefined;
		},
		"push-branch": async ({ head }) => {
			const pushed = await onBranch(git, p, onRunBranch(head), (worktree) => pushRunBranch({ git: worktree.git, base: p.base, pulls: p.pulls, commits: p.commits }, branch));

			return pushed.kind === "pushed" ? undefined : unpushed(pass.item, branch, pushed);
		},
		"save-landing": async ({ head }) => landing(head, async () => undefined),
		land: async ({ head }) => landing(head, land),
	} satisfies Appliers;

	let result: ThinResult | undefined;

	for (const intent of pass.intents.toSorted((a, b) => APPLY_ORDER.indexOf(a.kind) - APPLY_ORDER.indexOf(b.kind))) {
		// SAFETY: each handler takes the variant its key names.
		result = (await (apply[intent.kind] as (intent: Intent) => Promise<ThinResult | undefined>)(intent)) ?? result;

		if (result !== undefined && result.outcome !== "landing" && result.outcome !== "merged" && result.outcome !== "review") break;
	}

	await releaseQuestions({ state: p.state, config: p.config, workSource: p.workSource, questions: p.questions, now: p.now });

	return result;
};

