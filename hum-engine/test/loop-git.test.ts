import { expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FollowUp, ItemRef, WorkSource } from "../src/adapter-api.ts";
import { gitIn } from "../src/adapters/git.ts";
import { historiesOf } from "../src/adapters/history.ts";
import type { PathRule } from "../src/config/schema.ts";
import { type Change, type Moment, placeChange } from "../src/decide/risk.ts";
import { blockedPaths, brokenCommits } from "../src/loop/breaks.ts";
import { proveCheck } from "../src/loop/proof.ts";
import type { ReviewNote } from "../src/loop/records.ts";
import { openState } from "../src/state/open.ts";
import { checkBaseAfterMerge } from "../src/worker/base-check.ts";
import { configWith } from "./fixtures/config.ts";
import { pastChange, reviewNote } from "./fixtures/records.ts";
import { sh } from "./fixtures/work-repo.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { tempDir } from "./fixtures/temp.ts";


const scratch = (): string => {
	const dir = tempDir("loop-git");

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

/** A check commit on top of the fixed base: the check script and the pattern it forbids. */
const checkItemHead = (dir: string, forbidden: string): string => {
	sh(dir, ["checkout", "-q", "-b", "check"]);

	return commit(dir, { "check.sh": `! grep -rq ${forbidden} src\n` }, "check: forbid");
};

const prove = (dir: string, head: string, notes: ReviewNote[]) => {
	const timeMs = 0;

	return proveCheck({ git: gitIn(dir, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), head, base: "main", notes, checks: ["sh check.sh"], timeoutMs: 20_000, now: () => timeMs + Date.now() });
};

/** A repo whose base fixed a violating commit, and a check that forbids `forbidden` on top of the fix. */
const checkOver = (forbidden: string) => {
	const dir = scratch();

	commit(dir, { "src/a.ts": "export const x = 1;\n" }, "init");
	const bad = violating(dir);

	commit(dir, { "src/a.ts": "export const x = 2;\n" }, "fix: a");

	return { dir, bad, head: checkItemHead(dir, forbidden) };
};

test("a check is real when it fails on the commit a note points at and passes on the base, and no worktree stays", async () => {
	const { dir, bad, head } = checkOver("legacy");

	expect(await prove(dir, head, [reviewNote({ change: bad })])).toMatchObject({ passed: true, worktrees: 2, ms: expect.any(Number) });
	expect(sh(dir, ["worktree", "list"]).trim().split("\n")).toHaveLength(1);
});

test("a check that misses the violation is refused, and no worktree stays", async () => {
	const { dir, bad, head } = checkOver("nothing-like-it");

	expect(await prove(dir, head, [reviewNote({ change: bad })])).toMatchObject({ passed: false, reason: `the check passes on ${bad}, the commit a note points at` });
	expect(sh(dir, ["worktree", "list"]).trim().split("\n")).toHaveLength(1);
});

test("a check whose note points at no commit is refused before any worktree", async () => {
	const { dir, head } = checkOver("legacy");

	expect(await prove(dir, head, [reviewNote({ change: "not-a-commit" })])).toMatchObject({ passed: false, worktrees: 0 });
});

const followUps = () => {
	const filed: { from: string; followUp: FollowUp }[] = [];

	const workSource = {
		fileFollowUp: async (from: string, followUp: FollowUp): Promise<ItemRef> => (filed.push({ from, followUp }), { id: `${from}-fix`, title: followUp.title }),
	} satisfies Pick<WorkSource, "fileFollowUp">;

	return { filed, workSource };
};

/** A merge of `src/a.ts` under the path rule `rule`, and a check of the base after it that `checks` decide. */
const mergedUnder = (rule: Omit<PathRule, "glob">) => {
	const dir = scratch();
	const state = openState(tempDir("state"), { now: Date.now });

	commit(dir, { "src/a.ts": "export const x = 1;\n" }, "init");
	const merged = violating(dir);

	sh(dir, ["remote", "add", "origin", dir]);
	state.merges.put("item-a", { item: "item-a", sha: merged, at: 1, paths: ["src/a.ts"] });

	const { filed, workSource } = followUps();
	const config = configWith((raw) => (raw.hum.paths = [{ glob: "src/**", ...rule }]));
	const checkBase = (checks: string[], at: number) => checkBaseAfterMerge({ state, config, workSource, git: gitIn(dir, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), remote: "origin", base: "main", checks, now: () => at, item: "item-a" });

	return { state, merged, filed, checkBase };
};

test("a check that fails on the base after a merge is a break: saved, its follow-up filed, and counted by the fix limit", async () => {
	const { state, merged, filed, checkBase } = mergedUnder({ level: "critical", proofs: { "*": "canary" }, limit: { fixes: 0, of: 5 } });

	await checkBase(["false"], 7);

	expect(state.breaks.get("item-a")).toMatchObject({ sha: merged, level: "critical", onBreak: "block", followUp: "item-a-fix" });
	expect(filed.map(({ followUp }) => followUp.body.split("\n")[0])).toEqual(["Kind: fix"]);
	expect(blockedPaths(state)).toEqual(["src/a.ts"]);

	state.merges.put("item-a-fix", { item: "item-a-fix", sha: "f", at: 9, paths: [] });
	expect(blockedPaths(state)).toEqual([]);

	await checkBase(["true"], 8);
	expect(filed).toHaveLength(1);
	expect([...brokenCommits(state)]).toEqual([merged]);
});

test("a break on a low path files its follow-up and blocks no path", async () => {
	const { state, filed, checkBase } = mergedUnder({ level: "low" });

	await checkBase(["false"], 7);

	expect(state.breaks.get("item-a")).toMatchObject({ level: "low", onBreak: "follow-up", followUp: "item-a-fix" });
	expect(filed).toHaveLength(1);
	expect(blockedPaths(state)).toEqual([]);
});

test("a commit whose merge broke the base is labelled fixed beside the breaks git shows, and raises its path past the fix limit", () => {
	const config = configWith((raw) => (raw.hum.paths = [{ glob: "ui/**", level: "low", limit: { fixes: 0, of: 5 } }]));
	const changes = [pastChange({ sha: "aaaaaaa", files: ["ui/a.ts"] }), pastChange({ sha: "bbbbbbb", files: ["ui/a.ts"] })];
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
