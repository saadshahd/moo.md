import { randomUUID } from "node:crypto";
import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gitIn, type GitIdentityRead, readGitIdentity } from "../src/adapters/git.ts";
import { loadConfig, readConfigDir } from "../src/config/load.ts";
import { kindCoverage, proposeSetup } from "../src/setup/propose.ts";
import { proveSetup } from "../src/setup/prove.ts";
import { scanRepo } from "../src/setup/scan.ts";
import { shippedConfig, shippedSettingsAs } from "../src/setup/shipped.ts";
import { waitsOf, withTimeouts } from "../src/setup/waits.ts";
import { SetupAnswers, writeSetup } from "../src/setup/write.ts";
import { hopeSkills } from "./fixtures/config.ts";
import { OWNER } from "./fixtures/identity.ts";
import { sh } from "./fixtures/work-repo.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { tempDir } from "./fixtures/temp.ts";

/** A git repo on `main` holding the files, with its remote as `origin`. */
const repoWith = (files: Record<string, string>): string => {
	const root = tempDir("setup");
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

/** What git config holds for the owner. */
const OWNER_GIT: GitIdentityRead = { found: true, identity: OWNER };

test("a scan reads the checks CI runs on a pull request after the install a fresh clone needs, the compose services and the issue-template labels", async () => {
	const scan = await scanRepo(repoWith(PROJECT), "main");
	const proposal = proposeSetup(scan, shipped.hum, { labels: ["bug", "docs"] });

	expect(scan.packageManager).toBe("bun");
	expect(scan.composeServices).toEqual([{ name: "db", image: "mongo:7" }]);
	expect(proposal.checks).toEqual(["bun install --frozen-lockfile", "bun run typecheck", "bun test"]);
	expect(proposal.runSlots.recipe.prepare).toContain("bun install --frozen-lockfile");
});

const AGENTS = `name: agents
on: [workflow_dispatch]
env:
  CLAUDE_CODE_USE_BEDROCK: '1'
  IS_SANDBOX: 1
  ANTHROPIC_CUSTOM_HEADERS: |
    x-team: one
    x-use: two
jobs:
  agents:
    runs-on: own-large
    container: mcr.microsoft.com/playwright:v1.0.0-noble
    env:
      GH_TOKEN: \${{ github.token }}
    steps:
      - uses: actions/create-github-app-token@v3
        with:
          client-id: \${{ secrets.APP_CLIENT_ID }}
          private-key: \${{ secrets.APP_PRIVATE_KEY }}
      - run: npm install --global @anthropic-ai/claude-code
`;

test("a scan proposes the wake job's runner, container, env and sign-in from the job that runs Claude Code, and the App from the step that mints a token", async () => {
	const { wakeJob } = proposeSetup(await scanRepo(repoWith({ ...PROJECT, ".github/workflows/agents.yml": AGENTS }), "main"), shipped.hum);

	expect(wakeJob).toEqual({
		ciRunner: "own-large",
		ciContainer: "mcr.microsoft.com/playwright:v1.0.0-noble",
		ciEnv: { CLAUDE_CODE_USE_BEDROCK: "1", IS_SANDBOX: "1", ANTHROPIC_CUSTOM_HEADERS: "x-team: one\nx-use: two\n" },
		ciClaudeAuth: "env",
		pullRequestToken: { from: "app", clientIdSecret: "APP_CLIENT_ID", privateKeySecret: "APP_PRIVATE_KEY" },
	});
});

/** The wake job setup proposes for a repo whose only workflow besides its checks is `workflow`. */
const wakeJobFrom = async (workflow: string, facts: { isPublic?: boolean } = {}) =>
	proposeSetup(await scanRepo(repoWith({ ...PROJECT, ".github/workflows/agents.yml": workflow }), "main"), shipped.hum, facts).wakeJob;

/** A workflow whose one job runs Claude Code on GitHub's runner, with `job` as the rest of the job. */
const claudeJob = (job: string): string => `on: [workflow_dispatch]\njobs:\n  agents:\n    runs-on: ubuntu-latest\n${job}`;

const CLAUDE_STEP = "    steps:\n      - run: npm install --global @anthropic-ai/claude-code\n";

test("a scan reads a runner written as a label list or a group, and a container with everything the job gives it", async () => {
	const listed = await wakeJobFrom(`on: [workflow_dispatch]
jobs:
  agents:
    runs-on: [self-hosted, linux]
    container:
      image: ghcr.io/own/agents:1
      credentials:
        username: \${{ github.actor }}
        password: \${{ secrets.REGISTRY_TOKEN }}
      env:
        NODE_ENV: test
      ports: [80, "8080:80"]
      volumes: ["/cache:/cache"]
      options: --cpus 2
${CLAUDE_STEP}`);

	const grouped = await wakeJobFrom(`on: [workflow_dispatch]\njobs:\n  agents:\n    runs-on:\n      group: agents\n      labels: linux\n${CLAUDE_STEP}`);

	expect(listed.ciRunner).toEqual(["self-hosted", "linux"]);
	expect(listed.ciContainer).toEqual({ image: "ghcr.io/own/agents:1", credentials: { username: "${{ github.actor }}", password: "${{ secrets.REGISTRY_TOKEN }}" }, env: { NODE_ENV: "test" }, ports: [80, "8080:80"], volumes: ["/cache:/cache"], options: "--cpus 2" });
	expect(grouped.ciRunner).toEqual({ group: "agents", labels: "linux" });
});

test("an env entry with no value is left out alone, and the rest of the map is read", async () => {
	const { ciEnv } = await wakeJobFrom(claudeJob(`    env:\n      EMPTY:\n      CLAUDE_CODE_USE_BEDROCK: 1\n${CLAUDE_STEP}`));

	expect(ciEnv).toEqual({ CLAUDE_CODE_USE_BEDROCK: "1" });
});

test("a runner, container or env value that reads the matrix, an earlier job or a step is not proposed, since the wake job has none", async () => {
	const wakeJob = await wakeJobFrom(`on: [workflow_dispatch]
jobs:
  agents:
    strategy:
      matrix:
        os: [ubuntu-latest]
    runs-on: \${{ matrix.os }}
    container: \${{ needs.build.outputs.image }}
    env:
      CLAUDE_CODE_USE_VERTEX: 1
      SHARD: \${{ matrix.shard }}
${CLAUDE_STEP}`);

	expect(wakeJob).toMatchObject({ ciRunner: shipped.hum.ciRunner, ciContainer: shipped.hum.ciContainer, ciEnv: { CLAUDE_CODE_USE_VERTEX: "1" } });
});

test("an API key the Claude Code action takes as an input becomes the env Claude Code reads it from, and sign-in is through env", async () => {
	const wakeJob = await wakeJobFrom(claudeJob("    steps:\n      - uses: anthropics/claude-code-action@v1\n        with:\n          anthropic_api_key: ${{ secrets.ANTHROPIC_KEY }}\n"));

	expect(wakeJob).toMatchObject({ ciEnv: { ANTHROPIC_API_KEY: "${{ secrets.ANTHROPIC_KEY }}" }, ciClaudeAuth: "env" });
});

test("an OAuth token the Claude Code action takes under any secret's name proposes the OAuth token sign-in", async () => {
	const wakeJob = await wakeJobFrom(claudeJob("    steps:\n      - uses: anthropics/claude-code-action@v1\n        with:\n          claude_code_oauth_token: ${{ secrets.MY_CLAUDE }}\n"));

	expect(wakeJob).toMatchObject({ ciEnv: {}, ciClaudeAuth: "oauth-token" });
});

test("a Claude Code job whose env holds no credential gets the shipped sign-in, never sign-in through an env that signs in with nothing", async () => {
	const wakeJob = await wakeJobFrom(claudeJob(`    env:\n      IS_SANDBOX: 1\n${CLAUDE_STEP}`));

	expect(wakeJob).toMatchObject({ ciEnv: { IS_SANDBOX: "1" }, ciClaudeAuth: shipped.hum.ciClaudeAuth });
});

test("on a public repo a runner GitHub does not host is not proposed", async () => {
	expect((await wakeJobFrom(AGENTS, { isPublic: true })).ciRunner).toBe(shipped.hum.ciRunner);
});

test("setup refuses a runner GitHub does not host on a public repo, or one whose visibility nothing read, until the owner agreed", () => {
	const answers = { hum: { checks: ["true"], runPlaces: ["ci" as const], ciRunner: ["self-hosted", "linux"] }, waitHours: {} };
	const write = (repo: string, more: Pick<SetupAnswers, "ownRunnerOnPublicRepo">, isPublicRepo?: boolean) => writeSetup(repo, SetupAnswers.parse({ ...answers, ...more }), { hopeSkills: hopeSkills(), gitIdentity: OWNER_GIT, isPublicRepo });
	const open = repoWith({ "README.md": "x" });
	const unread = write(repoWith({ "README.md": "x" }), {});
	const refused = write(open, {}, true);

	expect(!refused.ok && refused.refusal.code).toBe("own-runner-on-public-repo");
	expect(!unread.ok && unread.refusal.code).toBe("own-runner-on-public-repo");
	expect(existsSync(join(open, ".hum"))).toBe(false);
	expect(write(open, { ownRunnerOnPublicRepo: true }, true).ok).toBe(true);
});

test("without a job that runs Claude Code, the wake job takes the pull request job's runner and the shipped rest, and hum's own workflows are not read", async () => {
	const repo = repoWith(PROJECT);

	expect(writeSetup(repo, { hum: { checks: ["true"], runPlaces: ["ci"], ciRunner: "own-large", ciClaudeAuth: "env" }, waitHours: {} }, { hopeSkills: hopeSkills(), gitIdentity: OWNER_GIT, isPublicRepo: false }).ok).toBe(true);
	expect(proposeSetup(await scanRepo(repo, "main"), shipped.hum).wakeJob).toEqual({
		ciRunner: "ubuntu-latest",
		ciContainer: shipped.hum.ciContainer,
		ciEnv: shipped.hum.ciEnv,
		ciClaudeAuth: shipped.hum.ciClaudeAuth,
		pullRequestToken: shipped.hum.pullRequestToken,
	});
});

test("setup rewrites a schema 1 hum.json at schema 2, its pull request token secret carried into the token source", () => {
	const repo = repoWith({ "README.md": "x" });
	const file = join(repo, ".hum", "hum.json");
	const answers = { hum: { checks: ["true"], runPlaces: ["ci" as const] }, waitHours: {} };

	expect(writeSetup(repo, answers, { hopeSkills: hopeSkills(), gitIdentity: OWNER_GIT }).ok).toBe(true);
	writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), schemaVersion: 1, pullRequestTokenSecret: "PR_TOKEN" }));
	expect(writeSetup(repo, answers, { hopeSkills: hopeSkills(), gitIdentity: OWNER_GIT }).ok).toBe(true);

	const written = JSON.parse(readFileSync(file, "utf8"));

	expect(written).toMatchObject({ schemaVersion: 2, pullRequestToken: { from: "secret", secret: "PR_TOKEN" } });
	expect(written).not.toHaveProperty("pullRequestTokenSecret");
	expect(readFileSync(join(repo, ".github", "workflows", "hum-wake.yml"), "utf8")).toContain("secrets.PR_TOKEN || github.token");
});

test("setup reads schema 1 answers, their pull request token secret carried into the token source", () => {
	const repo = repoWith({ "README.md": "x" });
	const answers = { hum: { checks: ["true"], runPlaces: ["ci" as const], pullRequestTokenSecret: "OTHER_TOKEN" }, waitHours: {}, schemaVersion: 1 };

	expect(writeSetup(repo, answers, { hopeSkills: hopeSkills(), gitIdentity: OWNER_GIT }).ok).toBe(true);
	expect(JSON.parse(readFileSync(join(repo, ".hum", "hum.json"), "utf8")).pullRequestToken).toEqual({ from: "secret", secret: "OTHER_TOKEN" });
});

test("a scan skips a workflow, compose or issue-template file that is not YAML and reads the rest", async () => {
	const broken = "key: [unclosed\n";
	const scan = await scanRepo(repoWith({ ...PROJECT, ".github/workflows/broken.yml": broken, "compose.yaml": broken, ".github/ISSUE_TEMPLATE/broken.yml": broken }), "main");

	expect(scan.ci.map(({ file }) => file)).toEqual(["ci.yml"]);
	expect(scan.composeServices).toEqual([]);
	expect(scan.issueTemplates.map(({ file }) => file)).toEqual(["bug.yml"]);
});

test("a repo's own executable environment script is the slot recipe's prepare and refresh", async () => {
	const repo = repoWith({ ...PROJECT, "scripts/env.sh": "#!/bin/sh\n" });

	chmodSync(join(repo, "scripts", "env.sh"), 0o755);

	expect(proposeSetup(await scanRepo(repo, "main"), shipped.hum).runSlots.recipe).toMatchObject({ prepare: ["./scripts/env.sh"], refresh: [{ run: "./scripts/env.sh", when: "lockfile-changed" }] });
});

test("a migration proposes a strict glob, and source and markdown get their own levels", async () => {
	const { paths, strictPaths } = proposeSetup(await scanRepo(repoWith(PROJECT), "main"), shipped.hum);

	expect(strictPaths).toContain("**/migrations/**");
	expect(paths.find(({ glob }) => glob === "*.md")?.level).toBe(shipped.hum.levels[0]?.name);
	expect(paths.some(({ glob }) => glob === "src/**")).toBe(true);
});

test("the repo's labels map to kinds, and the map covers the open items that carry one", async () => {
	const proposal = proposeSetup(await scanRepo(repoWith(PROJECT), "main"), shipped.hum, { labels: ["bug", "documentation", "question"] });
	const items = [{ body: "", labels: ["bug"] }, { body: "", labels: ["documentation"] }, { body: "", labels: [] }, { body: "", labels: ["question"] }];

	expect(proposal.kindLabels).toMatchObject({ bug: "fix", documentation: "docs" });
	expect(kindCoverage(items, shipped.hum.kinds, proposal.kindLabels)).toEqual({ covered: 2, total: 4 });
});

test("every wait the shipped kinds have is asked once, and an answered wait carries its hours as its timeout", () => {
	const waits = waitsOf(shipped.kinds);

	expect(waits.length).toBeGreaterThan(0);
	expect(new Set(waits.map(({ kind, state }) => `${kind}/${state}`)).size).toBe(waits.length);

	const [first] = waits;
	const kinds = withTimeouts(shipped.kinds, { [`${first?.kind}/${first?.state}`]: 5 });

	expect(JSON.stringify(kinds[first?.kind ?? ""]?.machine.states[first?.state ?? ""]?.after)).toContain(String(5 * 3_600_000));
});

test("writing setup answers writes a config that loads and carries only the settings that differ from the defaults", () => {
	const repo = repoWith({ "README.md": "x" });
	const result = writeSetup(repo, { hum: { checks: ["true"], kindLabels: { bug: "fix" }, runPlaces: ["ci"] }, waitHours: {} }, { hopeSkills: hopeSkills(), home: join(repo, "home"), gitIdentity: OWNER_GIT });

	expect(result.ok).toBe(true);

	const written = JSON.parse(readFileSync(join(repo, ".hum", "hum.json"), "utf8"));

	expect(written).toMatchObject({ checks: ["true"], kindLabels: { bug: "fix" }, commitIdentity: OWNER });
	expect(written.claimExpirySeconds).toBeUndefined();
	expect(existsSync(join(repo, ".github", "workflows"))).toBe(true);
	expect(existsSync(join(repo, "home"))).toBe(false);
	expect(loadConfig(readConfigDir(join(repo, ".hum")), { env: { hopeSkills: hopeSkills() } }).ok).toBe(true);
});

test("setup keeps the commit identity hum.json already names over the one git config holds", () => {
	const repo = repoWith({ "README.md": "x" });
	const answers = { hum: { checks: ["true"], runPlaces: ["ci" as const] }, waitHours: {} };
	const later: GitIdentityRead = { found: true, identity: { name: "Later", email: "later@example.com" } };

	expect(writeSetup(repo, answers, { hopeSkills: hopeSkills(), gitIdentity: OWNER_GIT }).ok).toBe(true);
	expect(writeSetup(repo, answers, { hopeSkills: hopeSkills(), gitIdentity: later }).ok).toBe(true);
	expect(JSON.parse(readFileSync(join(repo, ".hum", "hum.json"), "utf8")).commitIdentity).toEqual(OWNER);
});

test("setup answers cannot name a commit identity, because they come from a model", () => {
	const answers = SetupAnswers.safeParse({ hum: { commitIdentity: { name: "hum", email: "hum@example.com" } } });

	expect(answers.success).toBe(false);
	expect(!answers.success && answers.error.message).toContain("commitIdentity is never an answer");
});

test("setup writes nothing and says what to set when git config holds no name or email", () => {
	const repo = repoWith({ "README.md": "x" });
	const result = writeSetup(repo, { hum: { checks: ["true"] }, waitHours: {} }, { hopeSkills: hopeSkills(), gitIdentity: { found: false, missing: ["user.email"] } });

	expect(!result.ok && result.refusal.code).toBe("no-git-identity");
	expect(!result.ok && result.refusal.message).toContain('git config --global user.email "<yours>"');
	expect(existsSync(join(repo, ".hum"))).toBe(false);
});

test("the shipped settings commit as the identity git config holds, and say what to set without one", () => {
	expect(shippedSettingsAs({ found: true, identity: OWNER })).toMatchObject({ ok: true, value: { commitIdentity: OWNER } });
	expect(shippedSettingsAs({ found: false, missing: ["user.name"] })).toMatchObject({ ok: false, refusal: { code: "no-git-identity", message: expect.stringContaining('git config --global user.name "<yours>"') } });
});

test("the owner's identity is read from git config, and each key it lacks is named", async () => {
	const repo = repoWith({ "README.md": "x" });
	const git = gitIn(repo, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS, env: { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });

	expect(await readGitIdentity(git)).toEqual({ found: false, missing: ["user.name", "user.email"] });
	sh(repo, ["config", "user.name", OWNER.name]);
	expect(await readGitIdentity(git)).toEqual({ found: false, missing: ["user.email"] });
	sh(repo, ["config", "user.email", OWNER.email]);
	expect(await readGitIdentity(git)).toEqual({ found: true, identity: OWNER });
});

test("setup writes nothing when the repo's hum.json is a schema this engine does not read", () => {
	const repo = repoWith({ ".hum/hum.json": JSON.stringify({ schemaVersion: 99 }) });
	const before = readFileSync(join(repo, ".hum", "hum.json"), "utf8");
	const result = writeSetup(repo, { hum: { checks: ["true"] }, waitHours: {} }, { hopeSkills: hopeSkills(), home: join(repo, "home"), gitIdentity: OWNER_GIT });

	expect(result.ok).toBe(false);
	expect(!result.ok && result.refusal.message).toContain("bun add --exact @moo.md/hum@latest");
	expect(readFileSync(join(repo, ".hum", "hum.json"), "utf8")).toBe(before);
	expect(existsSync(join(repo, ".hum", "kinds"))).toBe(false);
});

test("setup writes nothing when the schema it would write is one this engine does not read", () => {
	const repo = repoWith({ "README.md": "x" });
	const result = writeSetup(repo, { hum: { checks: ["true"] }, waitHours: {}, schemaVersion: 99 }, { hopeSkills: hopeSkills(), gitIdentity: OWNER_GIT });

	expect(result.ok).toBe(false);
	expect(existsSync(join(repo, ".hum"))).toBe(false);
});

test("proving a written setup on a scratch copy passes its checks and contract, and skips the item without --item", async () => {
	const repo = repoWith({ "package.json": PINNED });

	expect(writeSetup(repo, { hum: { checks: ["true"], runPlaces: ["ci"] }, waitHours: {} }, { hopeSkills: hopeSkills(), gitIdentity: OWNER_GIT }).ok).toBe(true);
	sh(repo, ["add", "-A"]);
	sh(repo, ["commit", "-q", "-m", "setup"]);
	sh(repo, ["push", "-q", "origin", "main"]);

	const steps = await proveSetup(repo, { now: Date.now, hopeSkills: hopeSkills(), base: "main", item: false, published: async () => "unpublished", newSessionId: randomUUID, processEnv: process.env });
	const byName = Object.fromEntries(steps.map((step) => [step.name, step.status]));

	expect(byName).toMatchObject({ config: "passed", checks: "passed", contract: "passed", "engine pin": "skipped", item: "skipped" });
	expect(steps.filter(({ status }) => status === "failed")).toEqual([]);
});

test("proving fails the checks step when a check command fails", async () => {
	const repo = repoWith({ "package.json": PINNED });

	// A work source that is not markdown skips the contract step, which the proving test above covers.
	writeSetup(repo, { hum: { checks: ["false"], runPlaces: ["ci"], integrations: { workSource: "github" } }, waitHours: {} }, { hopeSkills: hopeSkills(), gitIdentity: OWNER_GIT });

	const steps = await proveSetup(repo, { now: Date.now, hopeSkills: hopeSkills(), base: "main", item: false, published: async () => "unpublished", newSessionId: randomUUID, processEnv: process.env });

	expect(steps.find(({ name }) => name === "checks")?.status).toBe("failed");
});

const SHIPPED_FIX = JSON.parse(readFileSync(join(import.meta.dir, "..", "defaults", "kinds", "fix.json"), "utf8"));

const WITHOUT_STUCK = {
	...SHIPPED_FIX,
	machine: {
		...SHIPPED_FIX.machine,
		states: Object.fromEntries(Object.entries<{ tags?: string[] }>(SHIPPED_FIX.machine.states).map(([name, node]) => [name, { ...node, tags: node.tags?.filter((tag) => tag !== "stuck") }])),
	},
};

test.each([
	["does not parse", { machine: 1 }, "malformed-config"],
	["has no stuck state for a wait to time out to", WITHOUT_STUCK, "invalid-config"],
] as const)("setup refuses a repo whose kind file %s", (_, fix, code) => {
	const repo = repoWith({ "README.md": "x" });
	const answers = { hum: { checks: ["true"], runPlaces: ["ci" as const] }, waitHours: {} };
	const env = { hopeSkills: hopeSkills(), gitIdentity: OWNER_GIT };

	expect(writeSetup(repo, answers, env).ok).toBe(true);
	writeFileSync(join(repo, ".hum", "kinds", "fix.json"), JSON.stringify(fix));

	const result = writeSetup(repo, answers, env);

	expect(!result.ok && result.refusal.code).toBe(code);
});
