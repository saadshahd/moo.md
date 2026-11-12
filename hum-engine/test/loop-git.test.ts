import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { FollowUp, ItemRef, WorkSource } from "../src/adapter-api.ts";
import { gitIn } from "../src/adapters/git.ts";
import { historiesOf } from "../src/adapters/history.ts";
import type { PastChange } from "../src/decide/labels.ts";
import { type Change, type Moment, placeChange } from "../src/decide/risk.ts";
import { blockedPaths, brokenCommits } from "../src/loop/breaks.ts";
import { proveCheck } from "../src/loop/proof.ts";
import type { ReviewNote } from "../src/loop/records.ts";
import { openState } from "../src/state/open.ts";
import { checkBaseAfterMerge } from "../src/worker/base-check.ts";
import { configWith } from "./fixtures/config.ts";
import { sh } from "./fixtures/work-repo.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";

const folders: string[] = [];

afterEach(() => {
	for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const scratch = (): string => {
	const dir = mkdtempSync(join(tmpdir(), "hum-loop-git-"));

	folders.push(dir);
	sh(dir, ["init", "-q", "-b", "main"]);

	return dir;
};

const commit = (dir: string, files: Record<string, string>, message: string): string => {
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, file)), { recursive: true });
		writeFileSync(join(dir, file), text);
	}

	sh(dir, ["add", "-A"]);
	sh(dir, ["commit", "-q", "-m", message]);

	return sh(dir, ["rev-parse", "HEAD"]).trim();
};

const violating = (dir: string): string => commit(dir, { "src/a.ts": "export const x = legacy();\n" }, "feat: a");

const note = (change: string): ReviewNote => ({ source: "review-comment", sourceId: "1", change, hunk: "", text: "No legacy calls.", at: 1 });

/** A check commit on top of the fixed base: the check script and the pattern it forbids. */
const checkItemHead = (dir: string, forbidden: string): string => {
	sh(dir, ["checkout", "-q", "-b", "check"]);

	return commit(dir, { "check.sh": `! grep -rq ${forbidden} src\n` }, "check: forbid");
};

const prove = (dir: string, head: string, notes: ReviewNote[]) => {
	const timeMs = 0;

	return proveCheck({ git: gitIn(dir, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), head, base: "main", notes, checks: ["sh check.sh"], timeoutMs: 20_000, now: () => timeMs + Date.now() });
};

test("a check is real when it fails on the commit a note points at and passes on the base; one that misses the violation is refused, and no worktree stays", async () => {
	const dir = scratch();

	commit(dir, { "src/a.ts": "export const x = 1;\n" }, "init");
	const bad = violating(dir);

	commit(dir, { "src/a.ts": "export const x = 2;\n" }, "fix: a");
	const real = checkItemHead(dir, "legacy");

	const proof = await prove(dir, real, [note(bad)]);

	expect(proof).toMatchObject({ passed: true, worktrees: 2, ms: expect.any(Number) });

	sh(dir, ["checkout", "-q", "main"]);
	sh(dir, ["branch", "-q", "-D", "check"]);

	const misses = checkItemHead(dir, "nothing-like-it");

	expect(await prove(dir, misses, [note(bad)])).toMatchObject({ passed: false, reason: `the check passes on ${bad}, the commit a note points at` });
	expect(await prove(dir, misses, [note("not-a-commit")])).toMatchObject({ passed: false, worktrees: 0 });
	expect(sh(dir, ["worktree", "list"]).trim().split("\n")).toHaveLength(1);
});

const followUps = () => {
	const filed: { from: string; followUp: FollowUp }[] = [];

	const workSource = {
		fileFollowUp: async (from: string, followUp: FollowUp): Promise<ItemRef> => (filed.push({ from, followUp }), { id: `${from}-fix`, title: followUp.title }),
	} satisfies Pick<WorkSource, "fileFollowUp">;

	return { filed, workSource };
};

test("a check that fails on the base after a merge is a break: saved, its follow-up filed, and counted by the fix limit", async () => {
	const dir = scratch();
	const state = openState(mkdtempSync(join(tmpdir(), "hum-state-")));

	folders.push(state.dir);
	commit(dir, { "src/a.ts": "export const x = 1;\n" }, "init");
	const merged = violating(dir);

	sh(dir, ["remote", "add", "origin", dir]);
	state.merges.put("item-a", { item: "item-a", sha: merged, at: 1, paths: ["src/a.ts"] });

	const { filed, workSource } = followUps();
	const config = configWith((raw) => (raw.hum.paths = [{ glob: "src/**", level: "critical", proofs: { "*": "canary" }, limit: { fixes: 0, of: 5 } }]));

	await checkBaseAfterMerge({ state, config, workSource, git: gitIn(dir, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), remote: "origin", base: "main", checks: ["false"], now: () => 7, item: "item-a" });

	expect(state.breaks.get("item-a")).toMatchObject({ sha: merged, level: "critical", onBreak: "block", followUp: "item-a-fix" });
	expect(filed.map(({ followUp }) => followUp.body.split("\n")[0])).toEqual(["Kind: fix"]);
	expect(blockedPaths(state)).toEqual(["src/a.ts"]);

	state.merges.put("item-a-fix", { item: "item-a-fix", sha: "f", at: 9, paths: [] });
	expect(blockedPaths(state)).toEqual([]);

	await checkBaseAfterMerge({ state, config, workSource, git: gitIn(dir, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), remote: "origin", base: "main", checks: ["true"], now: () => 8, item: "item-a" }).then(() => expect(filed).toHaveLength(1));
	expect([...brokenCommits(state)]).toEqual([merged]);
});

const past = (sha: string, over: Partial<PastChange> = {}): PastChange => ({ sha, subject: "feat: x", body: "", files: ["ui/a.ts"], size: 1, blamed: [], ...over });

test("a commit whose merge broke the base is labelled fixed beside the breaks git shows, and raises its path past the fix limit", () => {
	const config = configWith((raw) => (raw.hum.paths = [{ glob: "ui/**", level: "low", limit: { fixes: 0, of: 5 } }]));
	const changes = [past("aaaaaaa"), past("bbbbbbb")];
	const change: Change = { paths: ["ui/b.ts"], size: 1, loosened: false, pinChanged: false };
	const levelWith = (broken: ReadonlySet<string>) => placeChange(change, config.hum, historiesOf(changes, config.hum, broken), { now: 0, base: "main" }).level.name;

	expect([levelWith(new Set()), levelWith(new Set(["aaaaaaa"]))]).toEqual(["low", "medium"]);
});

test("a kind's floor and a blocked path each lift the level, and the steps say why", () => {
	const config = configWith((raw) => (raw.hum.paths = [{ glob: "ui/**", level: "low" }]));
	const change: Change = { paths: ["ui/b.ts"], size: 1, loosened: false, pinChanged: false };
	const place = (moment: Partial<Moment>) => placeChange(change, config.hum, new Map(), { now: 0, base: "main", ...moment });

	expect(place({}).level.name).toBe("low");
	expect(place({ kindFloor: "high" })).toMatchObject({ level: { name: "high" }, steps: expect.arrayContaining([{ step: "kind-floor", level: "high" }]) });
	expect(place({ blocked: ["ui/b.ts"] })).toMatchObject({ level: { name: "critical" }, steps: expect.arrayContaining([{ step: "blocked-path", path: "ui/b.ts" }]) });
});
