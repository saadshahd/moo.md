import { afterEach, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderUnit, type UnitVars } from "../src/service/unit.ts";

const templates = join(import.meta.dir, "..", "templates");

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
	env: { HUM_KIND: "docs", HUM_CHECKS: JSON.stringify(["bun test", "bun run lint"]) },
	log: "/Users/o/Library/Logs/hum.log",
};

const has = (tool: string): boolean => Bun.which(tool) !== null;

if (!has("plutil")) console.log("skip plutil: this machine has no plutil (macOS only); the launchd plist is linted on a Mac");

if (!has("actionlint")) console.log("skip actionlint: it is not installed (brew install actionlint)");

if (!has("systemd-analyze")) console.log("skip systemd-analyze verify: it is not installed (Linux only); slice 18 runs it in moo's Linux CI");

const plutil = (args: string[], file: string) => Bun.spawnSync(["plutil", ...args, file]);

test.skipIf(!has("plutil"))("plutil -lint passes on the launchd template and on the unit rendered from it", () => {
	const rendered = join(temp(), "unit.plist");

	writeFileSync(rendered, renderUnit("launchd", vars));

	for (const file of [join(templates, "launchd", "md.moo.hum.plist"), rendered]) {
		const lint = plutil(["-lint"], file);

		expect(lint.stdout.toString() + lint.stderr.toString()).toContain("OK");
	}
});

test.skipIf(!has("plutil"))("the rendered plist restarts only after a failure, keeps the paths absolute and carries the environment", () => {
	const rendered = join(temp(), "unit.plist");

	writeFileSync(rendered, renderUnit("launchd", vars));

	const json = JSON.parse(plutil(["-convert", "json", "-o", "-"], rendered).stdout.toString());

	expect(json).toMatchObject({
		Label: vars.label,
		ProgramArguments: vars.command,
		WorkingDirectory: vars.repo,
		// The start script exits 0 when it gives up (R7); only a failure starts it again.
		KeepAlive: { SuccessfulExit: false },
		EnvironmentVariables: { PATH: vars.path, HUM_KIND: "docs" },
	});
});

test.skipIf(!has("actionlint"))("actionlint passes on every CI template, with the wake workflow they call beside them", () => {
	const repo = temp();
	const workflows = join(repo, ".github", "workflows");

	Bun.spawnSync(["git", "init", "-q"], { cwd: repo });
	mkdirSync(workflows, { recursive: true });

	const files = readdirSync(join(templates, "ci"));

	for (const file of files) copyFileSync(join(templates, "ci", file), join(workflows, file));

	const lint = Bun.spawnSync(["actionlint", "-no-color"], { cwd: repo });

	expect(lint.stdout.toString() + lint.stderr.toString()).toBe("");
	expect(lint.exitCode).toBe(0);
	expect(files.sort()).toEqual(["hum-comment.yml", "hum-dispatch.yml", "hum-push.yml", "hum-schedule.yml", "hum-wake.yml"]);
});

test("the CI templates wake on the four events, never resume a session and gate nothing", () => {
	const read = (file: string) => readFileSync(join(templates, "ci", file), "utf8");
	const all = readdirSync(join(templates, "ci")).map(read).join("\n");

	expect(read("hum-comment.yml")).toContain("issue_comment");
	expect(read("hum-push.yml")).toContain('".hum/work/**"');
	expect(read("hum-dispatch.yml")).toContain("repository_dispatch");
	expect(read("hum-schedule.yml")).toContain("cron:");
	// Q2: no artifact store, no transcript, no --resume, and no approval gate.
	expect(all).not.toMatch(/upload-artifact|download-artifact|--resume|environment:/);
	// A comment's text is never put into a shell line: event data reaches the script through env only.
	expect(read("hum-wake.yml")).not.toMatch(/run:.*\$\{\{/);
});

test("the systemd unit restarts after a failure only, and its command is one absolute line", () => {
	const unit = renderUnit("systemd", { ...vars, repo: "/home/o/repo" });

	expect(unit).toContain("Restart=on-failure");
	expect(unit).toContain("WorkingDirectory=/home/o/repo");
	expect(unit).toContain(`ExecStart="/opt/homebrew/bin/bun" "/Users/o/repos/a & b/node_modules/.bin/hum" "serve"`);
	expect(unit).toContain('Environment="PATH=/opt/homebrew/bin:/usr/bin:/bin"');
	expect(unit).not.toContain("{{");

	const file = join(temp(), "hum.service");

	writeFileSync(file, unit);

	if (!has("systemd-analyze")) return;

	// `verify` wants the command to exist, so it runs the real bun by its path.
	writeFileSync(file, renderUnit("systemd", { ...vars, repo: tmpdir(), command: [process.execPath, "serve"] }));

	const verify = Bun.spawnSync(["systemd-analyze", "verify", file]);

	expect(verify.stderr.toString()).toBe("");
});

test("a value with a line break, or a template naming an unknown key, is refused", () => {
	expect(() => renderUnit("launchd", { ...vars, repo: "/a\n/b" })).toThrow("line break");
	expect(() => renderUnit("systemd", { ...vars, env: { X: "1\n2" } })).toThrow("line break");
});

test("launchd values are escaped as XML and systemd words are quoted", () => {
	expect(renderUnit("launchd", vars)).toContain("<string>/Users/o/repos/a &amp; b</string>");
	expect(renderUnit("systemd", { ...vars, command: ["/bin/echo", "50%", "$HOME"] })).toContain('ExecStart="/bin/echo" "50%%" "$$HOME"');
});
