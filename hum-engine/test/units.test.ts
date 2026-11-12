import { afterEach, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "plist";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { renderUnit, type UnitVars } from "../src/service/unit.ts";
import { ciWorkflows, type WorkflowSettings } from "../src/service/workflows.ts";
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

/** A repo whose CI runs in a job container on its own runner, signs Claude Code in through a gateway and mints its token from a GitHub App. */
const gateway: WorkflowSettings = {
	...settings,
	ciRunner: "own-large",
	ciContainer: CONTAINER,
	ciEnv: { IS_SANDBOX: "1", ANTHROPIC_BEDROCK_BASE_URL: "https://gateway.example.com", ANTHROPIC_DEFAULT_HAIKU_MODEL: "${{ vars.HAIKU_MODEL }}", ANTHROPIC_CUSTOM_HEADERS: "x-team: one\nx-use: two\n" },
	ciClaudeAuth: "env",
	pullRequestToken: { from: "app", clientIdSecret: "APP_CLIENT_ID", privateKeySecret: "APP_PRIVATE_KEY" },
};

const Trigger = z.object({ on: z.record(z.string(), z.json()) });

const Step = z.object({
	id: z.string().optional(),
	if: z.string().optional(),
	run: z.string().optional(),
	uses: z.string().optional(),
	with: z.record(z.string(), z.json()).optional(),
	env: z.record(z.string(), z.string()).optional(),
});

const Wake = z.object({
	on: z.object({ workflow_call: z.object({ secrets: z.record(z.string(), z.object({ required: z.boolean() })) }) }),
	permissions: z.record(z.string(), z.string()),
	jobs: z.object({ wake: z.object({ "runs-on": z.string(), container: z.string().optional(), env: z.record(z.string(), z.string()), steps: z.array(Step) }) }),
});

const wakeText = (from: WorkflowSettings): string => ciWorkflows(from).find(({ file }) => file === "hum-wake.yml")?.text ?? "";

const wakeOf = (from: WorkflowSettings) => Wake.parse(parseYaml(wakeText(from)));

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

// actionlint 1.7.12 knows create-github-app-token v3 only by app-id, which v3 deprecates for client-id.
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
	const wakeSteps = Wake.parse(parseYaml(files["hum-wake.yml"] ?? "")).jobs.wake.steps;

	expect(Object.keys(on("hum-comment.yml"))).toEqual(["issue_comment"]);
	expect(on("hum-push.yml")).toEqual({ push: { branches: ["**", "!bots/run/**"], paths: ["work/items/**"] } });
	expect(Object.keys(on("hum-dispatch.yml"))).toEqual(["repository_dispatch"]);
	expect(on("hum-schedule.yml")).toMatchObject({ schedule: [{ cron: "7 * * * *" }] });
	expect(files["hum-wake.yml"]).toContain("HUM_GIT_EMAIL: bot@example.com");
	expect(files["hum-wake.yml"]).toContain("timeout-minutes: 15");
	expect(Object.values(files).join("\n")).not.toMatch(/upload-artifact|download-artifact|--resume|environment:/);
	// A comment's text never reaches a shell line: event data comes through env only.
	expect([...wakeSteps, ...wakeOf(gateway).jobs.wake.steps].every((step) => !step.run?.includes("${{"))).toBe(true);
});

test("the wake job runs on the runner and in the container the settings name, and gives every step their env as written", () => {
	const shipped = wakeOf(settings).jobs.wake;
	const own = wakeOf(gateway).jobs.wake;

	expect(shipped["runs-on"]).toBe("ubuntu-latest");
	expect(wakeText(settings)).not.toContain("container:");
	expect(own["runs-on"]).toBe("own-large");
	expect(own.container).toBe(CONTAINER);
	expect(own.env).toMatchObject(gateway.ciEnv);
	expect(own.env.HUM_EVENT).toBe("${{ github.event_name }}");
});

test("signed in with the OAuth token, the wake requires its secret and hands it to Claude Code; signed in through env, it names no such secret", () => {
	const token = wakeOf(settings);

	expect(token.on.workflow_call.secrets.CLAUDE_CODE_OAUTH_TOKEN).toEqual({ required: true });
	expect(token.jobs.wake.env.CLAUDE_CODE_OAUTH_TOKEN).toBe("${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}");
	expect(wakeText(gateway)).not.toContain("CLAUDE_CODE_OAUTH_TOKEN");
});

test("a secret's token is the run's GH_TOKEN, and falls back to the workflow token while the secret is unset", () => {
	const { on, jobs } = wakeOf(settings);

	expect(on.workflow_call.secrets.PR_TOKEN).toEqual({ required: false });
	expect(jobs.wake.steps.at(-1)?.env?.GH_TOKEN).toBe("${{ secrets.PR_TOKEN || github.token }}");
	expect(wakeText(settings)).not.toContain("create-github-app-token");
});

test("an App's token is minted last, with the workflow's own permissions, from the two secrets the settings name, and falls back to the workflow token while the client ID is unset", () => {
	const { on, permissions, jobs } = wakeOf(gateway);
	const [mint, wake] = jobs.wake.steps.slice(-2);

	expect(on.workflow_call.secrets).toEqual({ APP_CLIENT_ID: { required: false }, APP_PRIVATE_KEY: { required: false } });
	expect(mint?.uses).toStartWith("actions/create-github-app-token@");
	expect(mint?.with).toEqual({
		"client-id": "${{ secrets.APP_CLIENT_ID }}",
		"private-key": "${{ secrets.APP_PRIVATE_KEY }}",
		...Object.fromEntries(Object.entries(permissions).map(([scope, level]) => [`permission-${scope}`, level])),
	});
	expect(mint?.if).toBe("env.HUM_HAS_APP == 'true'");
	expect(jobs.wake.env.HUM_HAS_APP).toBe("${{ secrets.APP_CLIENT_ID != '' }}");
	expect(wake?.env?.GH_TOKEN).toBe(`\${{ steps.${mint?.id}.outputs.token || github.token }}`);
});

test("the git setup step hands git the run's GH_TOKEN when git asks, with no gh, and trusts the checkout", () => {
	const step = wakeOf(settings).jobs.wake.steps.find(({ run }) => run?.includes("credential"));
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
