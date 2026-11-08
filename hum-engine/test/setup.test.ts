import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { loadConfig, readConfigDir } from "../src/config/load.ts";
import { declaredKind } from "../src/decide/kind.ts";
import { kindCoverage, proposeSetup } from "../src/setup/propose.ts";
import { proveSetup } from "../src/setup/prove.ts";
import { scanRepo } from "../src/setup/scan.ts";
import { shippedConfig } from "../src/setup/shipped.ts";
import { waitsOf, withTimeouts } from "../src/setup/waits.ts";
import { writeSetup } from "../src/setup/write.ts";
import { hopeSkills } from "./fixtures/config.ts";
import { sh } from "./fixtures/work-repo.ts";

/** A git repo on `main` holding the files, with its remote as `origin`. */
const repoWith = (files: Record<string, string>): string => {
	const root = mkdtempSync(join(tmpdir(), "hum-setup-"));
	const repo = join(root, "repo");

	sh(root, ["init", "-q", "--bare", "-b", "main", "remote.git"]);
	sh(root, ["init", "-q", "-b", "main", repo]);
	sh(repo, ["remote", "add", "origin", join(root, "remote.git")]);

	for (const [path, text] of Object.entries(files)) {
		mkdirSync(dirname(join(repo, path)), { recursive: true });
		writeFileSync(join(repo, path), text);
	}

	sh(repo, ["add", "-A"]);
	sh(repo, ["commit", "-q", "-m", "init"]);
	sh(repo, ["push", "-q", "origin", "main"]);

	return repo;
};

const CI = `name: ci
on: [pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun test
`;

const COMPOSE = "services:\n  db:\n    image: mongo:7\n";

const BUG_TEMPLATE = "name: Bug\nlabels: [bug]\nbody: []\n";

const PROJECT = {
	"package.json": JSON.stringify({ scripts: { typecheck: "tsc", test: "bun test", seed: "bun seed.ts" } }),
	"bun.lock": "",
	".github/workflows/ci.yml": CI,
	"compose.yaml": COMPOSE,
	".github/ISSUE_TEMPLATE/bug.yml": BUG_TEMPLATE,
	"db/migrations/001.sql": "select 1;\n",
	"src/app.ts": "export {};\n",
	"README.md": "# app\n",
};

const PINNED = JSON.stringify({ devDependencies: { "@moo.md/hum": "0.1.0" } });

const shipped = shippedConfig();

test("a scan reads the checks CI runs on a pull request after the install a fresh clone needs, the compose services and the issue-template labels", async () => {
	const scan = await scanRepo(repoWith(PROJECT), "main");
	const proposal = proposeSetup(scan, shipped.hum, ["bug", "docs"]);

	expect(scan.packageManager).toBe("bun");
	expect(scan.composeServices).toEqual([{ name: "db", image: "mongo:7" }]);
	expect(proposal.checks).toEqual(["bun install --frozen-lockfile", "bun run typecheck", "bun test"]);
	expect(proposal.runSlots.recipe.prepare).toContain("bun install --frozen-lockfile");
});

test("a migration proposes a strict glob, and source and markdown get their own levels", async () => {
	const { paths, strictPaths } = proposeSetup(await scanRepo(repoWith(PROJECT), "main"), shipped.hum);

	expect(strictPaths).toContain("**/migrations/**");
	expect(paths.find(({ glob }) => glob === "*.md")?.level).toBe(shipped.hum.levels[0]?.name);
	expect(paths.some(({ glob }) => glob === "src/**")).toBe(true);
});

test("the repo's labels map to kinds, and the map covers the open items that carry one", async () => {
	const proposal = proposeSetup(await scanRepo(repoWith(PROJECT), "main"), shipped.hum, ["bug", "documentation", "question"]);
	const items = [{ body: "", labels: ["bug"] }, { body: "", labels: ["documentation"] }, { body: "", labels: [] }, { body: "", labels: ["question"] }];

	expect(proposal.kindLabels).toMatchObject({ bug: "fix", documentation: "docs" });
	expect(kindCoverage(items, shipped.hum.kinds, proposal.kindLabels)).toEqual({ covered: 2, total: 4 });
	expect(declaredKind({ body: "", labels: ["Bug"] }, shipped.hum.kinds, proposal.kindLabels)).toBe("fix");
});

test("every wait the shipped kinds have is asked once, and an answered wait carries its hours as its timeout", () => {
	const waits = waitsOf(shipped.kinds);

	expect(waits.length).toBeGreaterThan(0);
	expect(new Set(waits.map(({ kind, state }) => `${kind}/${state}`)).size).toBe(waits.length);

	const [first] = waits;
	const kinds = withTimeouts(shipped.kinds, { [`${first?.kind}/${first?.state}`]: 5 });

	expect(JSON.stringify(kinds[first?.kind ?? ""]?.machine.states[first?.state ?? ""]?.after)).toContain(String(5 * 3_600_000));
});

test("the shipped kinds alone do not load, because their waits have no timeout", () => {
	const raw = readConfigDir(join(import.meta.dir, "..", "defaults"));

	expect(loadConfig(raw, { env: { hopeSkills: hopeSkills() } }).ok).toBe(false);
});

test("writing setup answers writes a config that loads and carries only the settings that differ from the defaults", () => {
	const repo = repoWith({ "README.md": "x" });
	const result = writeSetup(repo, { hum: { checks: ["true"], kindLabels: { bug: "fix" }, runPlaces: ["ci"] }, waitHours: {} }, { hopeSkills: hopeSkills(), home: join(repo, "home") });

	expect(result.ok).toBe(true);

	const written = JSON.parse(readFileSync(join(repo, ".hum", "hum.json"), "utf8"));

	expect(written).toMatchObject({ checks: ["true"], kindLabels: { bug: "fix" } });
	expect(written.claimExpirySeconds).toBeUndefined();
	expect(existsSync(join(repo, ".github", "workflows"))).toBe(true);
	expect(existsSync(join(repo, "home"))).toBe(false);
	expect(loadConfig(readConfigDir(join(repo, ".hum")), { env: { hopeSkills: hopeSkills() } }).ok).toBe(true);
});

test("setup writes nothing when the repo's hum.json is a schema this engine does not read", () => {
	const repo = repoWith({ ".hum/hum.json": JSON.stringify({ schemaVersion: 99 }) });
	const before = readFileSync(join(repo, ".hum", "hum.json"), "utf8");
	const result = writeSetup(repo, { hum: { checks: ["true"] }, waitHours: {} }, { hopeSkills: hopeSkills(), home: join(repo, "home") });

	expect(result.ok).toBe(false);
	expect(!result.ok && result.refusal.message).toContain("bun add --exact @moo.md/hum@latest");
	expect(readFileSync(join(repo, ".hum", "hum.json"), "utf8")).toBe(before);
	expect(existsSync(join(repo, ".hum", "kinds"))).toBe(false);
});

test("setup writes nothing when the schema it would write is one this engine does not read", () => {
	const repo = repoWith({ "README.md": "x" });
	const result = writeSetup(repo, { hum: { checks: ["true"] }, waitHours: {}, schemaVersion: 99 }, { hopeSkills: hopeSkills() });

	expect(result.ok).toBe(false);
	expect(existsSync(join(repo, ".hum"))).toBe(false);
});

test("proving a written setup on a scratch copy passes its checks and contract, and skips the item without --item", async () => {
	const repo = repoWith({ "package.json": PINNED });

	expect(writeSetup(repo, { hum: { checks: ["true"], runPlaces: ["ci"] }, waitHours: {} }, { hopeSkills: hopeSkills() }).ok).toBe(true);
	sh(repo, ["add", "-A"]);
	sh(repo, ["commit", "-q", "-m", "setup"]);
	sh(repo, ["push", "-q", "origin", "main"]);

	const steps = await proveSetup(repo, { hopeSkills: hopeSkills(), base: "main", item: false, published: async () => "unpublished" });
	const byName = Object.fromEntries(steps.map((step) => [step.name, step.status]));

	expect(byName).toMatchObject({ config: "passed", checks: "passed", contract: "passed", "engine pin": "skipped", item: "skipped" });
	expect(steps.filter(({ status }) => status === "failed")).toEqual([]);
});

test("proving fails the checks step when a check command fails", async () => {
	const repo = repoWith({ "package.json": PINNED });

	writeSetup(repo, { hum: { checks: ["false"], runPlaces: ["ci"] }, waitHours: {} }, { hopeSkills: hopeSkills() });

	const steps = await proveSetup(repo, { hopeSkills: hopeSkills(), base: "main", item: false, published: async () => "unpublished" });

	expect(steps.find(({ name }) => name === "checks")?.status).toBe("failed");
});
