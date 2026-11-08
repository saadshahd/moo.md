import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gitIn } from "../src/adapters/git.ts";
import { changeOf, historiesOf, readHistory } from "../src/adapters/history.ts";

import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { labelChanges, matchedSample, type PastChange } from "../src/decide/labels.ts";
import { isCleared, landingOf, routeOf } from "../src/decide/merge.ts";
import { reviewInput } from "../src/decide/review.ts";
import { type Change, type Histories, type Label, placeChange, type Policy, usualSize } from "../src/decide/risk.ts";
import { ruleGlobFor } from "../src/worker/land.ts";
import { configWith } from "./fixtures/config.ts";
import { sh } from "./fixtures/work-repo.ts";

const config = configWith();
const NOW = Date.parse("2026-11-08");

const policy = (over: Partial<Policy> = {}): Policy => ({
	...config.hum,
	paths: [
		{ glob: "ui/**", level: "low", limit: { fixes: 1, of: 4 } },
		{ glob: "docs/**", level: "low" },
		{ glob: "billing/**", level: "critical", proofs: { refactor: "existing tests pass", "*": "a day on the canary" } },
	],
	strictPaths: ["migrations/**", "secrets/**"],
	...over,
});

const change = (paths: string[], over: Partial<Change> = {}): Change => ({ paths, size: 5, loosened: false, pinChanged: false, ...over });

const labelled = (glob: string, labels: Label[]): Histories => new Map([[glob, { sizes: labels.map(() => 5), labels }]]);

const place = (c: Change, p = policy(), histories: Histories = new Map(), moment = { now: NOW, base: "main" }) => placeChange(c, p, histories, moment);

const levelOf = (c: Change, p?: Policy, histories?: Histories, moment?: { now: number; base: string }) => place(c, p, histories, moment).level.name;

test("prototyping, a low-risk UI tweak: merged on green, no question", () => {
	const placed = place(change(["ui/button.tsx"]));
	const route = routeOf(placed, policy().paths, "feature", ["ui/button.tsx"]);

	expect(route).toMatchObject({ level: { name: "low" }, unclear: [], mergesAlone: true, proof: undefined });
	expect(landingOf(false, isCleared(route, { review: false, owner: false }))).toEqual({ via: "push" });
});

test("a break after merge on a low path becomes follow-up work that counts toward the limit, and blocks on a critical path", () => {
	const [low, , , critical] = config.hum.levels;

	expect([low?.onBreak, critical?.onBreak]).toEqual(["follow-up", "block"]);
	expect(levelOf(change(["ui/a.tsx"]), undefined, labelled("ui/**", ["fixed", "clean", "clean", "clean"]))).toBe("low");
});

test("follow-ups past a path's limit raise it one step, and it comes back once they leave the window", () => {
	const piled = place(change(["ui/a.tsx"]), undefined, labelled("ui/**", ["fixed", "reverted", "clean", "clean"]));

	expect(piled.level.name).toBe("medium");
	expect(piled.steps).toContainEqual({ step: "fix-limit", glob: "ui/**", level: "medium", breaks: 2, limit: 1 });
	expect(levelOf(change(["ui/a.tsx"]), undefined, labelled("ui/**", ["clean", "clean", "clean", "clean", "fixed", "reverted"]))).toBe("low");
});

test("a refactor on the critical billing path gets checks, an agent review and the owner's review, and release waits for billing's proof", () => {
	const route = routeOf(place(change(["billing/invoice.ts"])), policy().paths, "refactor", ["billing/invoice.ts"]);

	expect(route).toMatchObject({ level: { name: "critical", review: "owner" }, mergesAlone: false, proof: "existing tests pass" });
	expect(routeOf(place(change(["billing/invoice.ts"])), policy().paths, "feature", ["billing/invoice.ts"]).proof).toBe("a day on the canary");
	expect(landingOf(true, false)).toEqual({ via: "pull-request", autoMerge: false });
	expect(landingOf(false, false)).toEqual({ via: "wait" });
});

test("a change touching docs and billing takes billing's level", () => {
	expect(levelOf(change(["docs/a.md", "billing/b.ts"]))).toBe("critical");
});

test("a migration on a low path takes the strictest level, whatever the path's level", () => {
	const placed = place(change(["docs/a.md", "migrations/0007_drop_column.sql"]));

	expect(placed.level.name).toBe("critical");
	expect(placed.steps).toContainEqual({ step: "data-or-secret", path: "migrations/0007_drop_column.sql" });
});

test("a launch raises a path between its dates or while the base matches, and only then", () => {
	const dated = policy({ launches: [{ glob: "ui/**", level: "high", from: "2026-11-01", until: "2026-11-15" }] });
	const onBranch = policy({ launches: [{ glob: "ui/**", level: "high", base: "release/*" }] });

	expect(levelOf(change(["ui/a.tsx"]), dated)).toBe("high");
	expect(levelOf(change(["ui/a.tsx"]), dated, new Map(), { now: Date.parse("2026-11-15"), base: "main" })).toBe("low");
	expect(levelOf(change(["ui/a.tsx"]), onBranch)).toBe("low");
	expect(levelOf(change(["ui/a.tsx"]), onBranch, new Map(), { now: NOW, base: "release/2" })).toBe("high");
});


test("a change touching a folder no rule places is unclear at the level of the rest, never merges alone, and its rule names the folder", () => {
	const placed = place(change(["docs/a.md", "tools/gen/x.ts"]));
	const route = routeOf(placed, policy().paths, "feature", ["docs/a.md", "tools/gen/x.ts"]);

	expect(placed.unclear).toEqual(["tools/gen/x.ts"]);
	expect(route).toMatchObject({ level: { name: "low" }, unclear: [{ cause: "paths", paths: ["tools/gen/x.ts"] }], mergesAlone: false });
	expect(isCleared(route, { review: true, owner: false })).toBe(false);
	expect(isCleared(route, { review: false, owner: true })).toBe(true);
	expect([ruleGlobFor("tools/gen/x.ts"), ruleGlobFor("README.md")]).toEqual(["tools/gen/**", "README.md"]);
	expect(levelOf(change(["only/new.ts"]))).toBe("low");
});

test("an urgent security fix on a critical path runs the hotfix kind's own states, straight to the owner's review", () => {
	const { states } = config.kinds.hotfix!.machine;

	expect(states.checking?.invoke?.onDone).toEqual([{ target: "owner-review" }]);
	expect(Object.keys(states)).not.toContain("reviewing");
	expect(routeOf(place(change(["billing/tax.ts"])), policy().paths, "hotfix", ["billing/tax.ts"]).mergesAlone).toBe(false);
});

test("hum's own config, the owner's adapters, workflows, hooks and the engine pin take the strictest level", () => {
	for (const path of [".hum/hum.json", "adapters/linear.ts", ".github/workflows/ci.yml", ".husky/pre-push"]) {
		expect(place(change(["docs/a.md", path])).steps, path).toContainEqual({ step: "own-config", path });
	}

	expect(place(change(["docs/a.md", "package.json"], { pinChanged: true })).steps).toContainEqual({ step: "engine-pin" });
	expect(levelOf(change(["docs/a.md", "package.json"]))).toBe("low");
});

test("a change above its path's usual size goes one step up; a path with too few changes has no range", () => {
	const sizes = Array.from({ length: 20 }, (_, i) => i + 1);
	const usual = usualSize(sizes, config.hum.sizeRange);

	expect(usual).toBeCloseTo(18.1, 1);
	expect(usualSize(sizes.slice(1), config.hum.sizeRange)).toBeUndefined();
	expect(levelOf(change(["docs/a.md"], { size: 19 }), undefined, new Map([["docs/**", { sizes, labels: [] }]]))).toBe("medium");
	expect(levelOf(change(["docs/a.md"], { size: 18 }), undefined, new Map([["docs/**", { sizes, labels: [] }]]))).toBe("low");
	expect(levelOf(change(["docs/a.md"], { loosened: true }))).toBe("medium");
});

const diff = (file: string, lines: string[]) => [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, `@@ -1,${lines.length} +1,${lines.length} @@`, ...lines, ""].join("\n");

test("a diff loosens a check by an added skip or lint disable, or a removed test, and changes the pin only on a line naming the engine", () => {
	const facts = (text: string) => changeOf(text, config.hum);

	expect(facts(diff("src/a.test.ts", ["+test.skip(\"x\", () => {});"])).loosened).toBe(true);
	expect(facts(diff("src/a.ts", ["+// oxlint-disable-next-line no-console"])).loosened).toBe(true);
	expect(facts(diff("src/a.test.ts", ["-test(\"x\", () => {});"])).loosened).toBe(true);
	expect(facts(diff("src/a.ts", ["+const skipped = 1;"])).loosened).toBe(false);
	expect(facts(diff("package.json", ["-\t\t\"@moo.md/hum\": \"0.1.0\",", "+\t\t\"@moo.md/hum\": \"0.2.0\","])).pinChanged).toBe(true);
	expect(facts(diff("package.json", ["-\t\t\"zod\": \"4.0.0\",", "+\t\t\"zod\": \"4.1.0\","])).pinChanged).toBe(false);
	expect(facts(diff("bun.lock", ["+\t\t\"@moo.md/hum\": [\"@moo.md/hum@0.2.0\"],"])).pinChanged).toBe(true);
	expect(facts(diff("docs/a.md", ["+one", "-two"]))).toMatchObject({ paths: ["docs/a.md"], size: 2 });
});

const past = (sha: string, subject: string, files: string[], over: Partial<PastChange> = {}): PastChange => ({ sha: sha.repeat(40).slice(0, 40), subject, body: "", files, size: 10, blamed: [], ...over });

test("a change is reverted by a trailer or a title, fixed by a fix in its window that names it or rewrites its lines, and clean otherwise", () => {
	const a = past("a", "feat: a", ["x.ts"]);
	const b = past("b", "feat: b", ["y.ts"]);
	const c = past("c", "feat: c", ["z.ts"]);
	const d = past("d", "feat: d", ["w.ts"]);

	const later = [
		past("1", "Revert \"feat: a\"", ["x.ts"]),
		past("2", "chore: undo", ["y.ts"], { body: `This reverts commit ${"b".repeat(40)}.` }),
		past("3", "fix: z again", ["z.ts"], { body: `After ${"c".repeat(7)}.` }),
		past("4", "fix(w): edge", ["w.ts"], { blamed: [d.sha] }),
	];

	const labels = labelChanges([a, b, c, d, ...later], SHIPPED_DEFAULTS.changeLabels);

	expect([a, b, c, d].map((x) => labels.get(x.sha))).toEqual(["reverted", "reverted", "fixed", "fixed"]);

	const busy = Array.from({ length: 10 }, (_, i) => past(String(i), `feat: ${i}`, ["w.ts"]));
	const late = labelChanges([d, ...busy, past("e", "fix: late", ["w.ts"], { blamed: [d.sha] })], SHIPPED_DEFAULTS.changeLabels);
	const notAFix = labelChanges([d, past("f", "feat: rework", ["w.ts"], { blamed: [d.sha] })], SHIPPED_DEFAULTS.changeLabels);

	expect([late.get(d.sha), notAFix.get(d.sha)]).toEqual(["clean", "clean"]);
});

test("the sample is every broken change plus, for each, the clean change on the same top folders nearest in size, each taken once", () => {
	const broken = past("a", "feat: a", ["ui/x.ts"], { size: 40 });
	const near = past("b", "feat: b", ["ui/y.ts"], { size: 38 });
	const far = past("c", "feat: c", ["ui/z.ts"], { size: 400 });
	const elsewhere = past("d", "feat: d", ["docs/x.md"], { size: 40 });
	const labels = new Map<string, Label>([[broken.sha, "fixed"], [near.sha, "clean"], [far.sha, "clean"], [elsewhere.sha, "clean"]]);

	expect(matchedSample([broken, near, far, elsewhere], labels).map(({ sha }) => sha[0])).toEqual(["a", "b"]);
});

test("git history: a fix commit carries the commits whose lines it rewrote, and the path's history labels them", async () => {
	const repo = mkdtempSync(join(tmpdir(), "hum-history-"));

	try {
		sh(repo, ["init", "-q", "-b", "main"]);
		writeFileSync(join(repo, "a.ts"), "one\ntwo\nthree\n");
		sh(repo, ["add", "-A"]);
		sh(repo, ["commit", "-q", "-m", "feat: a"]);
		writeFileSync(join(repo, "a.ts"), "one\nTWO\nthree\n");
		sh(repo, ["commit", "-q", "-am", "fix: two"]);

		const changes = await readHistory(gitIn(repo), "main", config.hum);
		const [first, fix] = changes;
		const histories = historiesOf(changes, { paths: [{ glob: "*.ts", level: "low" }], changeLabels: config.hum.changeLabels });

		expect(fix?.blamed).toEqual([first?.sha ?? ""]);
		expect(histories.get("*.ts")).toEqual({ sizes: [2, 3], labels: ["clean", "fixed"] });
	} finally {
		rmSync(repo, { recursive: true, force: true });
	}
});

test("a fresh review run reads the item and the diff, and none of the author's plan or answers", () => {
	const item = { id: "7", title: "Add a button", body: "A blue one.", ready: true, thread: [{ kind: "comment" as const, text: "hum plan:\nuse the red theme", at: NOW }] };
	const input = reviewInput(item, diff("ui/button.tsx", ["+<Button />"]), config.hum);

	expect(input).toContain("# Item 7: Add a button");
	expect(input).toContain("+<Button />");
	expect(input).not.toContain("red theme");
});
