import { afterEach, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "plist";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { renderUnit, type UnitVars } from "../src/service/unit.ts";
import { ciWorkflows, type WorkflowSettings } from "../src/service/workflows.ts";
import { ENGINE_VERSION } from "../src/state/format.ts";
import { tempDir } from "./fixtures/temp.ts";

const dirs: string[] = [];

const temp = () => {
	const dir = tempDir("unit-lint");

	dirs.push(dir);

	return dir;
};

afterEach(() => {
	for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const vars: UnitVars = {
	label: "md.moo.hum.scratch.test",
	repo: "/Users/o/repos/a & b",
	command: ["/opt/homebrew/bin/bun", "/Users/o/repos/a & b/node_modules/.bin/hum", "serve"],
	path: "/opt/homebrew/bin:/usr/bin:/bin",
	env: { HUM_HOPE_ROOT: "/Users/o/.claude/plugins/hope" },
	log: "/Users/o/Library/Logs/hum.log",
	restartDelaySeconds: 42,
};

const settings: WorkflowSettings = {
	...SHIPPED_DEFAULTS,
	runBranchPrefix: "bots/run/",
	itemsDir: "work/items",
	ciSchedule: "7 * * * *",
	commitIdentity: { name: "bot", email: "bot@example.com" },
	ciWakeTimeoutMinutes: 15,
	pullRequestToken: { from: "secret", secret: "PR_TOKEN" },
};

const CONTAINER = "mcr.microsoft.com/playwright:v1.0.0-noble";

/** Env that reads no secret: a gateway's address, a model from a variable, headers on two lines. */
const OPEN_ENV = { IS_SANDBOX: "1", ANTHROPIC_BEDROCK_BASE_URL: "https://gateway.example.com", ANTHROPIC_DEFAULT_HAIKU_MODEL: "${{ vars.HAIKU_MODEL }}", ANTHROPIC_CUSTOM_HEADERS: "x-team: one\nx-use: two\n" };

/** Env that reads a secret: the gateway's token. */
const SECRET_ENV = { ANTHROPIC_AUTH_TOKEN: "${{ secrets.GATEWAY_TOKEN }}" };

/** A repo whose CI runs on its own runner, in a job container from a private registry, signs Claude Code in through a gateway and mints its token from a GitHub App. */
const gateway: WorkflowSettings = {
	...settings,
	ciRunner: "own-large",
	ciContainer: { image: CONTAINER, credentials: { username: "${{ vars.REGISTRY_USER }}", password: "${{ secrets.REGISTRY_TOKEN }}" }, env: { NODE_ENV: "test" }, ports: [80, "8080:80"], volumes: ["/cache:/cache"], options: "--cpus 2" },
	ciEnv: { ...OPEN_ENV, ...SECRET_ENV },
	ciClaudeAuth: "env",
	pullRequestToken: { from: "app", clientIdSecret: "APP_CLIENT_ID", privateKeySecret: "APP_PRIVATE_KEY" },
};

const Trigger = z.object({ on: z.record(z.string(), z.json()), jobs: z.object({ wake: z.object({ if: z.string().optional() }) }) });

const Step = z.object({
	id: z.string().optional(),
	if: z.string().optional(),
	run: z.string().optional(),
	uses: z.string().optional(),
	with: z.record(z.string(), z.json()).optional(),
	env: z.record(z.string(), z.string()).optional(),
});

const Job = z.object({
	needs: z.json().optional(),
	permissions: z.record(z.string(), z.string()),
	"runs-on": z.json(),
	container: z.json().optional(),
	"timeout-minutes": z.number(),
	env: z.record(z.string(), z.string()).optional(),
	outputs: z.record(z.string(), z.string()).optional(),
	steps: z.array(Step),
});

const Wake = z.object({
	on: z.object({ workflow_call: z.object({ secrets: z.record(z.string(), z.object({ required: z.boolean() })) }) }),
	permissions: z.record(z.string(), z.string()),
	jobs: z.object({ gather: Job, work: Job, publish: Job }),
});

const wakeText = (from: WorkflowSettings): string => ciWorkflows(from).find(({ file }) => file === "hum-wake.yml")?.text ?? "";

const wakeOf = (from: WorkflowSettings) => Wake.parse(parseYaml(wakeText(from)));

/** The jobs of the wake that hold GitHub's token. */
const tokenJobs = (from: WorkflowSettings) => {
	const { gather, publish } = wakeOf(from).jobs;

	return [gather, publish];
};

const allSteps = (from: WorkflowSettings) => Object.values(wakeOf(from).jobs).flatMap(({ steps }) => steps);

/** The step of a job that runs hum's part of the wake. */
const humStep = (job: z.infer<typeof Job>) => job.steps.find(({ run }) => run?.includes("hum wake "));

const has = (tool: string): boolean => Bun.which(tool) !== null;

const writeWorkflows = (repo: string, from: WorkflowSettings): void => {
	const folder = join(repo, ".github", "workflows");

	mkdirSync(folder, { recursive: true });

	for (const { file, text } of ciWorkflows(from)) writeFileSync(join(folder, file), text);
};

test.skipIf(!has("plutil"))("plutil -lint passes on the rendered launchd plist", () => {
	const rendered = join(temp(), "unit.plist");

	writeFileSync(rendered, renderUnit("launchd", vars));

	const lint = Bun.spawnSync(["plutil", "-lint", rendered]);

	expect(lint.stdout.toString() + lint.stderr.toString()).toContain("OK");
});

test("the launchd plist restarts only after a failure, keeps the paths absolute and escapes and carries the environment", () => {
	expect(parse(renderUnit("launchd", vars))).toMatchObject({
		Label: vars.label,
		ProgramArguments: vars.command,
		WorkingDirectory: vars.repo,
		KeepAlive: { SuccessfulExit: false },
		ThrottleInterval: 42,
		EnvironmentVariables: { PATH: vars.path, HUM_HOPE_ROOT: vars.env?.HUM_HOPE_ROOT },
	});
});

/** actionlint 1.7.12 knows create-github-app-token v3 only by app-id, which v3 deprecates for client-id. */
const STALE_ACTION_INPUTS = ["-ignore", 'missing input "app-id"', "-ignore", 'input "client-id" is not defined'];

test.skipIf(!has("actionlint"))("actionlint passes on every CI workflow, with the wake workflow they call beside them", () => {
	for (const from of [settings, gateway]) {
		const repo = temp();

		Bun.spawnSync(["git", "init", "-q"], { cwd: repo });
		writeWorkflows(repo, from);
		writeFileSync(join(repo, ".github", "actionlint.yaml"), `self-hosted-runner:\n  labels: [${gateway.ciRunner}]\n`);

		const lint = Bun.spawnSync(["actionlint", "-no-color", ...STALE_ACTION_INPUTS], { cwd: repo });

		expect(lint.stdout.toString() + lint.stderr.toString()).toBe("");
		expect(lint.exitCode).toBe(0);
	}
});

test("the CI workflows wake on the four events from the settings, never resume a session and gate nothing", () => {
	const files = Object.fromEntries(ciWorkflows(settings).map(({ file, text }) => [file, text]));
	const on = (file: string) => Trigger.parse(parseYaml(files[file] ?? "")).on;
	const { gather, work, publish } = wakeOf(settings).jobs;

	expect(Object.keys(on("hum-comment.yml"))).toEqual(["issue_comment"]);
	expect(on("hum-push.yml")).toEqual({ push: { branches: ["**", "!bots/run/**"], paths: ["work/items/**"] } });
	expect(Trigger.parse(parseYaml(files["hum-push.yml"] ?? "")).jobs.wake.if).toBe("github.ref_name == github.event.repository.default_branch");
	expect(Object.keys(on("hum-dispatch.yml"))).toEqual(["repository_dispatch"]);
	expect(on("hum-schedule.yml")).toMatchObject({ schedule: [{ cron: "7 * * * *" }] });
	expect(files["hum-wake.yml"]).toContain("HUM_GIT_EMAIL: bot@example.com");
	expect([gather, work, publish].map((job) => job["timeout-minutes"])).toEqual([60, 15, 60]);
	expect(Object.values(files).join("\n")).not.toMatch(/--resume|environment:|actions\/cache/);
	// A comment's text never reaches a shell line: event data comes through env only.
	expect([...allSteps(settings), ...allSteps(gateway)].every((step) => !step.run?.includes("${{"))).toBe(true);
});

test("a comment wakes hum only when the repo's owner, a member or a collaborator wrote it, and never a bot", () => {
	const text = ciWorkflows(settings).find(({ file }) => file === "hum-comment.yml")?.text ?? "";

	expect(Trigger.parse(parseYaml(text)).jobs.wake.if).toBe(`github.event.comment.user.type != 'Bot' && contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.comment.author_association)`);
});

test("a value two keys share is written out under both, with no YAML anchor", () => {
	expect(wakeOf(gateway).on.workflow_call.secrets.APP_CLIENT_ID).toEqual({ required: false });
	expect(wakeText(gateway)).not.toMatch(/[&*]a\d/);
});

test("each action runs at one commit, with its release beside it as a comment", () => {
	const uses = ciWorkflows(gateway).flatMap(({ text }) => text.split("\n").filter((line) => /uses: [^.]/.test(line)).map((line) => line.trim().replace(/^- /, "")));
	const checkout = "uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1";
	const mint = "uses: actions/create-github-app-token@64ab729a6294000f5aa4a4bc0b73d1f32bc45510 # v3.3.0";
	const download = "uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2";

	expect(uses).toEqual([checkout, mint, checkout, download, "uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2", checkout, download, mint]);
});

test("each job of the wake runs on the runner and in the container the settings name, as written", () => {
	const own = Object.values(wakeOf(gateway).jobs);

	expect(Object.values(wakeOf(settings).jobs).map((job) => job["runs-on"])).toEqual(["ubuntu-latest", "ubuntu-latest", "ubuntu-latest"]);
	expect(wakeText(settings)).not.toContain("container:");
	expect(own.map((job) => [job["runs-on"], job.container])).toEqual(own.map(() => ["own-large", gateway.ciContainer]));
	expect(wakeOf({ ...gateway, ciRunner: { group: "agents", labels: ["self-hosted", "linux"] } }).jobs.work["runs-on"]).toEqual({ group: "agents", labels: ["self-hosted", "linux"] });
});

test("env that reads no secret reaches every step, and env that reads one reaches only the steps that run hum", () => {
	const { jobs } = wakeOf(gateway);

	expect(jobs.gather.env).toEqual({ ...OPEN_ENV, HUM_HAS_APP: "${{ secrets.APP_CLIENT_ID != '' && secrets.APP_PRIVATE_KEY != '' }}", HUM_EVENT: "${{ github.event_name }}" });
	expect(jobs.work.env).toEqual(OPEN_ENV);

	for (const job of Object.values(jobs)) expect(humStep(job)?.env).toMatchObject(SECRET_ENV);

	expect(allSteps(gateway).filter((step) => JSON.stringify(step.env ?? {}).includes("GATEWAY_TOKEN") && !step.run?.includes("hum wake "))).toEqual([]);
});

test("every secret the runner, container and env name is declared for the called workflow, and none is required", () => {
	expect(wakeOf(gateway).on.workflow_call.secrets).toMatchObject({ GATEWAY_TOKEN: { required: false }, REGISTRY_TOKEN: { required: false } });
});

test("signed in with the OAuth token, the wake requires its secret and hands it to the steps that run hum alone; signed in through env, it names no such secret", () => {
	const token = wakeOf(settings);

	expect(token.on.workflow_call.secrets.CLAUDE_CODE_OAUTH_TOKEN).toEqual({ required: true });

	for (const job of Object.values(token.jobs)) expect(humStep(job)?.env?.CLAUDE_CODE_OAUTH_TOKEN).toBe("${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}");

	expect(wakeText(settings).match(/CLAUDE_CODE_OAUTH_TOKEN: \$/g)).toHaveLength(3);
	expect(wakeText(gateway)).not.toContain("CLAUDE_CODE_OAUTH_TOKEN");
});

test("git's global config and the installed tools sit in the runner's temp folder, so a wake leaves nothing on a machine that outlives it", () => {
	for (const { steps } of Object.values(wakeOf(settings).jobs)) {
		const paths = steps.find(({ run }) => run?.includes("GITHUB_ENV"));
		const folder = temp();
		const files = { GITHUB_ENV: join(folder, "env"), GITHUB_PATH: join(folder, "path") };

		expect(Bun.spawnSync(["bash", "-ec", paths?.run ?? "false"], { env: { PATH: process.env.PATH, RUNNER_TEMP: "/runner/temp", ...files } }).exitCode).toBe(0);
		expect(readFileSync(files.GITHUB_ENV, "utf8")).toBe("GIT_CONFIG_GLOBAL=/runner/temp/hum-gitconfig\n");
		expect(readFileSync(files.GITHUB_PATH, "utf8")).toBe("/runner/temp/hum-tools/bin\n");
		expect(steps.findIndex((step) => step === paths)).toBeLessThan(steps.findIndex(({ run }) => run?.includes("git config --global")));
		expect(steps.find(({ run }) => run?.startsWith("npm install"))?.run).toStartWith('npm install --global --prefix "$RUNNER_TEMP/hum-tools" ');
	}
});

test("a secret's token is GH_TOKEN in the jobs that hold GitHub's token, and falls back to the workflow token while the secret is unset", () => {
	const { on } = wakeOf(settings);

	expect(on.workflow_call.secrets.PR_TOKEN).toEqual({ required: false });
	expect(tokenJobs(settings).map((job) => humStep(job)?.env?.GH_TOKEN)).toEqual(["${{ secrets.PR_TOKEN || github.token }}", "${{ secrets.PR_TOKEN || github.token }}"]);
	expect(wakeText(settings)).not.toContain("create-github-app-token");
});

test("an App's token is minted last in each job that holds it, with the workflow's own permissions, from the two secrets the settings name, and a job whose App secrets are unset stops first, naming them", () => {
	const { on, permissions } = wakeOf(gateway);

	expect(on.workflow_call.secrets).toMatchObject({ APP_CLIENT_ID: { required: false }, APP_PRIVATE_KEY: { required: false } });
	expect(permissions).toEqual({});

	for (const job of tokenJobs(gateway)) {
		const [mint, wake] = job.steps.slice(-2);

		expect(mint?.uses).toStartWith("actions/create-github-app-token@");
		expect(mint?.with).toEqual({
			"client-id": "${{ secrets.APP_CLIENT_ID }}",
			"private-key": "${{ secrets.APP_PRIVATE_KEY }}",
			"permission-contents": "write",
			"permission-issues": "write",
			"permission-pull-requests": "write",
		});
		expect(job.permissions).toEqual({ contents: "write", issues: "write", "pull-requests": "write" });
		expect(mint?.if).toBeUndefined();
		expect(wake?.env?.GH_TOKEN).toBe(`\${{ steps.${mint?.id}.outputs.token }}`);

		const [check] = job.steps;
		const ran = Bun.spawnSync(["bash", "-ec", check?.run ?? "true"], { env: { PATH: process.env.PATH } });

		expect(check?.if).toBe("env.HUM_HAS_APP != 'true'");
		expect(ran.exitCode).toBe(1);
		expect(ran.stdout.toString()).toContain("::error title=hum::The GitHub App secrets APP_CLIENT_ID and APP_PRIVATE_KEY are not both set.");
	}
});

test("the work job holds no GitHub token: it reads the repo alone, at the base gather saw, and learns what gather settled from gather's output", () => {
	const { gather, work, publish } = wakeOf(gateway).jobs;
	const text = JSON.stringify(work);

	expect(work.permissions).toEqual({ contents: "read" });
	expect(text).not.toMatch(/GH_TOKEN|APP_CLIENT_ID|APP_PRIVATE_KEY|credential\.https/);
	expect(work.needs).toBe("gather");
	expect(publish.needs).toEqual(["gather", "work"]);
	expect(gather.outputs?.gathered).toBe(`\${{ steps.${humStep(gather)?.id}.outputs.gathered }}`);
	expect(humStep(publish)?.env?.HUM_GATHERED).toBe("${{ needs.gather.outputs.gathered }}");

	for (const job of [work, publish]) expect(job.steps.find(({ uses }) => uses?.startsWith("actions/checkout@"))?.with?.ref).toBe("${{ fromJSON(needs.gather.outputs.gathered).baseSha }}");
});

test("the checkout keeps no token in the workspace; the jobs that hold GitHub's token install hum from npm, none of the repo's packages and no plugin, and the work job installs its plugins after its packages", () => {
	const { work } = wakeOf(settings).jobs;
	const at = (steps: typeof work.steps, found: (typeof work.steps)[number] | undefined) => steps.findIndex((step) => step === found);

	for (const { steps } of Object.values(wakeOf(settings).jobs)) expect(steps.find(({ uses }) => uses?.startsWith("actions/checkout@"))?.with).toMatchObject({ "fetch-depth": 0, "persist-credentials": false });

	for (const { steps } of tokenJobs(settings)) {
		expect(steps.find(({ run }) => run?.startsWith("npm install"))?.run).toEndWith(` @moo.md/hum@${ENGINE_VERSION}`);
		expect(steps.filter(({ run }) => run?.includes("bun install") || run?.includes("node_modules"))).toEqual([]);
		expect(steps.filter(({ run }) => run?.includes("plugins"))).toEqual([]);
	}

	expect(at(work.steps, work.steps.find(({ run }) => run === "./node_modules/.bin/hum plugins"))).toBeGreaterThan(at(work.steps, work.steps.find(({ run }) => run === "bun install --frozen-lockfile")));
	expect(wakeText(settings)).not.toContain("claude plugin");
});

test("the git setup step hands git the run's GH_TOKEN when git asks, with no gh, and trusts the checkout", () => {
	const step = wakeOf(settings).jobs.gather.steps.find(({ run }) => run?.includes("credential"));
	const home = temp();
	const env = { PATH: process.env.PATH, HOME: home, GIT_CONFIG_GLOBAL: join(home, "gitconfig"), GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", GITHUB_WORKSPACE: home, ...step?.env };

	expect(Bun.spawnSync(["bash", "-ec", step?.run ?? "false"], { env }).exitCode).toBe(0);

	const fill = Bun.spawnSync(["bash", "-ec", "printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill"], { env: { ...env, GH_TOKEN: "t0ken" } });
	const trusted = Bun.spawnSync(["git", "config", "--global", "--get-all", "safe.directory"], { env });

	expect(fill.stdout.toString()).toContain("username=x-access-token\npassword=t0ken\n");
	expect(trusted.stdout.toString().trim()).toBe(home);
});

test("the systemd unit restarts after a failure only, and its command is one absolute line", () => {
	const unit = renderUnit("systemd", { ...vars, repo: "/home/o/repo" });

	expect(unit).toContain("Restart=on-failure");
	expect(unit).toContain("RestartSec=42");
	expect(unit).toContain("WorkingDirectory=/home/o/repo");
	expect(unit).toContain(`ExecStart="/opt/homebrew/bin/bun" "/Users/o/repos/a & b/node_modules/.bin/hum" "serve"`);
	expect(unit).toContain('Environment="PATH=/opt/homebrew/bin:/usr/bin:/bin"');
});

test("systemd words are quoted so no specifier or variable expands, and a value with a line break is refused", () => {
	expect(renderUnit("systemd", { ...vars, command: ["/bin/echo", "50%", "$HOME"] })).toContain('ExecStart="/bin/echo" "50%%" "$$HOME"');
	expect(() => renderUnit("systemd", { ...vars, env: { X: "1\n2" } })).toThrow("line break");
});

test.skipIf(!has("systemd-analyze"))("systemd-analyze verify passes on the rendered unit", () => {
	const file = join(temp(), "hum.service");

	// `verify` wants the command to exist, so it runs the real bun by its path.
	writeFileSync(file, renderUnit("systemd", { ...vars, repo: tmpdir(), command: [process.execPath, "serve"] }));

	// `--recursive-errors=no` keeps the warnings of the host's own units, which `verify` loads as dependencies, out of stderr.
	expect(Bun.spawnSync(["systemd-analyze", "verify", "--recursive-errors=no", file]).stderr.toString()).toBe("");
});
