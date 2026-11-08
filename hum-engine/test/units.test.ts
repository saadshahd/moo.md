import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "plist";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { renderUnit, type UnitVars } from "../src/service/unit.ts";
import { ciWorkflows, type WorkflowSettings } from "../src/service/workflows.ts";

const dirs: string[] = [];

const temp = () => {
	const dir = mkdtempSync(join(tmpdir(), "hum-unit-lint-"));

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
	env: { HUM_CHECKS: JSON.stringify(["bun test", "bun run lint"]) },
	log: "/Users/o/Library/Logs/hum.log",
	restartDelaySeconds: 42,
};

const settings: WorkflowSettings = { ...SHIPPED_DEFAULTS, runBranchPrefix: "bots/run/", itemsDir: "work/items", ciSchedule: "7 * * * *", commitIdentity: { name: "bot", email: "bot@example.com" }, ciWakeTimeoutMinutes: 15 };

const Trigger = z.object({ on: z.record(z.string(), z.json()) });

const Wake = z.object({ jobs: z.object({ wake: z.object({ steps: z.array(z.object({ run: z.string().optional() })) }) }) });

const has = (tool: string): boolean => Bun.which(tool) !== null;

const writeWorkflows = (repo: string): void => {
	const folder = join(repo, ".github", "workflows");

	mkdirSync(folder, { recursive: true });

	for (const { file, text } of ciWorkflows(settings)) writeFileSync(join(folder, file), text);
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
		EnvironmentVariables: { PATH: vars.path, HUM_CHECKS: vars.env?.HUM_CHECKS },
	});
});

test.skipIf(!has("actionlint"))("actionlint passes on every CI workflow, with the wake workflow they call beside them", () => {
	const repo = temp();

	Bun.spawnSync(["git", "init", "-q"], { cwd: repo });
	writeWorkflows(repo);

	const lint = Bun.spawnSync(["actionlint", "-no-color"], { cwd: repo });

	expect(lint.stdout.toString() + lint.stderr.toString()).toBe("");
	expect(lint.exitCode).toBe(0);
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
	expect(wakeSteps.every((step) => !step.run?.includes("${{"))).toBe(true);
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

	expect(Bun.spawnSync(["systemd-analyze", "verify", file]).stderr.toString()).toBe("");
});
