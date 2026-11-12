import { expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitIn } from "../src/adapters/git.ts";
import { changeOf, historiesOf, readHistory } from "../src/adapters/history.ts";

import { createActor, waitFor } from "xstate";
import { kindMachine } from "../src/config/machine.ts";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { labelChanges, matchedSample } from "../src/decide/labels.ts";
import { isCleared, type Landing, landingOf, routeOf } from "../src/decide/merge.ts";
import { reviewInput } from "../src/decide/review.ts";
import { type Change, type Histories, type Label, placeChange, type Policy, usualSize } from "../src/decide/risk.ts";
import { ruleGlobFor } from "../src/worker/land.ts";
import { configWith } from "./fixtures/config.ts";
import { pastChange } from "./fixtures/records.ts";
import { sh } from "./fixtures/work-repo.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { tempDir } from "./fixtures/temp.ts";

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
	expect(landingOf({ requiresPullRequest: false, cleared: isCleared(route, { review: false, owner: false }) })).toEqual({ via: "push" });
});

test("follow-ups up to a path's limit leave its level", () => {
	expect(levelOf(change(["ui/a.tsx"]), undefined, labelled("ui/**", ["fixed", "clean", "clean", "clean"]))).toBe("low");
});

test("follow-ups past a path's limit raise it one step, and it comes back once they leave the window", () => {
	const piled = place(change(["ui/a.tsx"]), undefined, labelled("ui/**", ["fixed", "reverted", "clean", "clean"]));

	expect(piled.level.name).toBe("medium");
	expect(piled.steps).toContainEqual({ step: "fix-limit", glob: "ui/**", level: "medium", breaks: 2, limit: 1 });
	expect(levelOf(change(["ui/a.tsx"]), undefined, labelled("ui/**", ["clean", "clean", "clean", "clean", "fixed", "reverted"]))).toBe("low");
});

test("a refactor on the critical billing path gets checks, an agent review and the owner's review, and release waits for its kind's proof", () => {
	const route = routeOf(place(change(["billing/invoice.ts"])), policy().paths, "refactor", ["billing/invoice.ts"]);

	expect(route).toMatchObject({ level: { name: "critical", review: "owner" }, mergesAlone: false, proof: "existing tests pass" });
});

test("a kind with no proof of its own on a path waits for the path's catch-all proof", () => {
	expect(routeOf(place(change(["billing/invoice.ts"])), policy().paths, "feature", ["billing/invoice.ts"]).proof).toBe("a day on the canary");
});

test.each<[boolean, Landing]>([
	[true, { via: "pull-request", autoMerge: false }],
	[false, { via: "wait" }],
])("an uncleared change where the base needs a pull request (%p) lands by %j", (needsPull, landing) => {
	expect(landingOf({ requiresPullRequest: needsPull, cleared: false })).toEqual(landing);
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


test("a change touching a folder no rule places is unclear at the level of the rest, and only the owner clears it", () => {
	const placed = place(change(["docs/a.md", "tools/gen/x.ts"]));
	const route = routeOf(placed, policy().paths, "feature", ["docs/a.md", "tools/gen/x.ts"]);

	expect(placed.unclear).toEqual(["tools/gen/x.ts"]);
	expect(route).toMatchObject({ level: { name: "low" }, unclear: [{ cause: "paths", paths: ["tools/gen/x.ts"] }], mergesAlone: false });
	expect(isCleared(route, { review: true, owner: false })).toBe(false);
	expect(isCleared(route, { review: false, owner: true })).toBe(true);
});

test.each([
	["tools/gen/x.ts", "tools/gen/**"],
	["README.md", "README.md"],
])("the rule for an unplaced %s names %s", (path, glob) => {
	expect(ruleGlobFor(path)).toBe(glob);
});

test("a change made only of unplaced paths takes the lowest level", () => {
	expect(levelOf(change(["only/new.ts"]))).toBe("low");
});

test("an urgent security fix on a critical path runs the hotfix kind's own states, straight to the owner's review", async () => {
	const visited = new Set<string>();
	const hotfix = createActor(kindMachine(config.kinds.hotfix!));

	hotfix.subscribe((snapshot) => void visited.add(String(snapshot.value)));
	hotfix.start();
	await waitFor(hotfix, (snapshot) => snapshot.value === "owner-review");
	hotfix.stop();

	expect([...visited]).toEqual(["building", "checking", "owner-review"]);
	expect(routeOf(place(change(["billing/tax.ts"])), policy().paths, "hotfix", ["billing/tax.ts"]).mergesAlone).toBe(false);
});

test.each([".hum/hum.json", "adapters/linear.ts", ".github/workflows/ci.yml", ".husky/pre-push"])("hum's own config, the owner's adapters, workflows and hooks take the strictest level: %s", (path) => {
	expect(place(change(["docs/a.md", path])).steps).toContainEqual({ step: "own-config", path });
});

test("a change to the engine pin takes the strictest level, and one to package.json alone does not", () => {
	expect(place(change(["docs/a.md", "package.json"], { pinChanged: true })).steps).toContainEqual({ step: "engine-pin" });
	expect(levelOf(change(["docs/a.md", "package.json"]))).toBe("low");
});

const TWENTY_SIZES = Array.from({ length: 20 }, (_, i) => i + 1);

test("a path's usual size is the top of its range, and a path with too few changes has no range", () => {
	expect(usualSize(TWENTY_SIZES, config.hum.sizeRange)).toBeCloseTo(18.1, 1);
	expect(usualSize(TWENTY_SIZES.slice(1), config.hum.sizeRange)).toBeUndefined();
});

test.each([
	[19, "medium"],
	[18, "low"],
])("a change of size %p on a path whose usual size is 18.1 is %s", (size, level) => {
	expect(levelOf(change(["docs/a.md"], { size }), undefined, new Map([["docs/**", { sizes: TWENTY_SIZES, labels: [] }]]))).toBe(level);
});

test("a change that loosens a check goes one step up", () => {
	expect(levelOf(change(["docs/a.md"], { loosened: true }))).toBe("medium");
});

const diff = (file: string, lines: string[]) => [`diff --git a/${file} b/${file}`, `--- a/${file}`, `+++ b/${file}`, `@@ -1,${lines.length} +1,${lines.length} @@`, ...lines, ""].join("\n");

const facts = (text: string) => changeOf(text, config.hum);

test.each([
	["an added skip", diff("src/a.test.ts", ["+test.skip(\"x\", () => {});"]), true],
	["an added lint disable", diff("src/a.ts", ["+// oxlint-disable-next-line no-console"]), true],
	["a removed test", diff("src/a.test.ts", ["-test(\"x\", () => {});"]), true],
	["a name that holds skip", diff("src/a.ts", ["+const skipped = 1;"]), false],
])("a diff with %s loosens a check: %p", (_, text, loosened) => {
	expect(facts(text).loosened).toBe(loosened);
});

test.each([
	["the engine's version in package.json", diff("package.json", ["-\t\t\"@moo.md/hum\": \"0.1.0\",", "+\t\t\"@moo.md/hum\": \"0.2.0\","]), true],
	["another package's version", diff("package.json", ["-\t\t\"zod\": \"4.0.0\",", "+\t\t\"zod\": \"4.1.0\","]), false],
	["the engine's line in bun.lock", diff("bun.lock", ["+\t\t\"@moo.md/hum\": [\"@moo.md/hum@0.2.0\"],"]), true],
])("a diff of %s changes the pin: %p", (_, text, pinChanged) => {
	expect(facts(text).pinChanged).toBe(pinChanged);
});

test("a diff's paths and size are its files and changed lines", () => {
	expect(facts(diff("docs/a.md", ["+one", "-two"]))).toMatchObject({ paths: ["docs/a.md"], size: 2 });
});

/** A full commit sha of one repeated character, as a revert trailer names it. */
const sha = (char: string): string => char.repeat(40);

test("a change is reverted by a trailer or a title, fixed by a fix in its window that names it or rewrites its lines, and clean otherwise", () => {
	const a = pastChange({ sha: sha("a"), subject: "feat: a", files: ["x.ts"] });
	const b = pastChange({ sha: sha("b"), subject: "feat: b", files: ["y.ts"] });
	const c = pastChange({ sha: sha("c"), subject: "feat: c", files: ["z.ts"] });
	const d = pastChange({ sha: sha("d"), subject: "feat: d", files: ["w.ts"] });

	const later = [
		pastChange({ sha: sha("1"), subject: "Revert \"feat: a\"", files: ["x.ts"] }),
		pastChange({ sha: sha("2"), subject: "chore: undo", files: ["y.ts"], body: `This reverts commit ${sha("b")}.` }),
		pastChange({ sha: sha("3"), subject: "fix: z again", files: ["z.ts"], body: `After ${"c".repeat(7)}.` }),
		pastChange({ sha: sha("4"), subject: "fix(w): edge", files: ["w.ts"], blamed: [d.sha] }),
	];

	const labels = labelChanges([a, b, c, d, ...later], SHIPPED_DEFAULTS.changeLabels);

	expect([a, b, c, d].map((x) => labels.get(x.sha))).toEqual(["reverted", "reverted", "fixed", "fixed"]);

	const busy = Array.from({ length: 10 }, (_, i) => pastChange({ sha: sha(String(i)), subject: `feat: ${i}`, files: ["w.ts"] }));
	const late = labelChanges([d, ...busy, pastChange({ sha: sha("e"), subject: "fix: late", files: ["w.ts"], blamed: [d.sha] })], SHIPPED_DEFAULTS.changeLabels);
	const notAFix = labelChanges([d, pastChange({ sha: sha("f"), subject: "feat: rework", files: ["w.ts"], blamed: [d.sha] })], SHIPPED_DEFAULTS.changeLabels);

	expect([late.get(d.sha), notAFix.get(d.sha)]).toEqual(["clean", "clean"]);
});

test("the sample is every broken change plus, for each, the clean change on the same top folders nearest in size, each taken once", () => {
	const broken = pastChange({ sha: sha("a"), subject: "feat: a", files: ["ui/x.ts"], size: 40 });
	const near = pastChange({ sha: sha("b"), subject: "feat: b", files: ["ui/y.ts"], size: 38 });
	const far = pastChange({ sha: sha("c"), subject: "feat: c", files: ["ui/z.ts"], size: 400 });
	const elsewhere = pastChange({ sha: sha("d"), subject: "feat: d", files: ["docs/x.md"], size: 40 });
	const labels = new Map<string, Label>([[broken.sha, "fixed"], [near.sha, "clean"], [far.sha, "clean"], [elsewhere.sha, "clean"]]);

	expect(matchedSample([broken, near, far, elsewhere], labels).map(({ sha }) => sha[0])).toEqual(["a", "b"]);
});

/** A repo whose second commit is a fix that rewrites a line the first wrote. */
const fixHistory = (): string => {
	const repo = tempDir("history");

	sh(repo, ["init", "-q", "-b", "main"]);
	writeFileSync(join(repo, "a.ts"), "one\ntwo\nthree\n");
	sh(repo, ["add", "-A"]);
	sh(repo, ["commit", "-q", "-m", "feat: a"]);
	writeFileSync(join(repo, "a.ts"), "one\nTWO\nthree\n");
	sh(repo, ["commit", "-q", "-am", "fix: two"]);

	return repo;
};

test("git history: a fix commit carries the commits whose lines it rewrote, and the path's history labels them", async () => {
	const repo = fixHistory();
	const changes = await readHistory(gitIn(repo, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), "main", config.hum);
	const [first, fix] = changes;
	const histories = historiesOf(changes, { paths: [{ glob: "*.ts", level: "low" }], changeLabels: config.hum.changeLabels });

	expect(fix?.blamed).toEqual([first?.sha ?? ""]);
	expect(histories.get("*.ts")).toEqual({ sizes: [2, 3], labels: ["clean", "fixed"] });
});

test("git history: a blame git fails throws, so a fix never reads as rewriting nothing", async () => {
	const repo = fixHistory();
	const real = gitIn(repo, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });
	const blameMissing = (args: readonly string[]) => (args[0] === "blame" ? [...args.slice(0, -1), "missing.ts"] : args);
	const git = { run: (args: readonly string[], input?: string) => real.run(blameMissing(args), input), raw: (args: readonly string[], input?: string) => real.raw(blameMissing(args), input) };

	await expect(readHistory(git, "main", config.hum)).rejects.toThrow("missing.ts");
});

test("a fresh review run reads the item and the diff, and none of the author's plan or answers", () => {
	const item = { id: "7", title: "Add a button", body: "A blue one.", ready: true, thread: [{ kind: "comment" as const, text: "hum plan:\nuse the red theme", at: NOW }] };
	const input = reviewInput(item, diff("ui/button.tsx", ["+<Button />"]), config.hum);

	expect(input).toContain("# Item 7: Add a button");
	expect(input).toContain("+<Button />");
	expect(input).not.toContain("red theme");
});
