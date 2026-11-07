import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { commands } from "../src/index.ts";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";

const MAIN = join(import.meta.dir, "..", "src", "cli", "main.ts");

const hum = (cwd: string, ...args: string[]) => {
	const result = spawnSync("bun", [MAIN, ...args], { cwd, encoding: "utf8" });

	return { code: result.status, out: result.stdout, err: result.stderr };
};

const json = (cwd: string, ...args: string[]) => {
	const result = hum(cwd, ...args);

	if (result.code !== 0) throw new Error(`hum ${args.join(" ")} exited ${result.code}: ${result.err}`);

	return JSON.parse(result.out);
};

test("hum help --json prints the op table, and every op the spec names is in it", () => {
	const printed = JSON.parse(hum(process.cwd(), "help", "--json").out);

	expect(printed).toEqual(JSON.parse(JSON.stringify(commands)));
	expect(Object.keys(printed).sort()).toEqual(
		["ask", "answer", "claim", "comment", "decide", "file-follow-up", "list-ready", "publish", "push", "read", "release", "watch"].sort(),
	);
});

test("an unknown op exits 2 and names the ops", () => {
	const result = hum(process.cwd(), "nope");

	expect(result.code).toBe(2);
	expect(result.err).toContain("list-ready");
});

test("hum push runs no hook, though a pre-push hook that would fail is installed", () => {
	const repo = new WorkRepo();
	const worker = repo.worker("w");
	const ran = join(repo.root, "pre-push-ran");
	const hook = join(worker, ".git", "hooks", "pre-push");

	mkdirSync(join(worker, ".git", "hooks"), { recursive: true });
	writeFileSync(hook, `#!/bin/sh\ntouch ${ran}\nexit 1\n`);
	chmodSync(hook, 0o755);
	writeFileSync(join(worker, "f.txt"), "x");
	sh(worker, ["add", "f.txt"]);
	sh(worker, ["commit", "-q", "-m", "f"]);

	expect(spawnSync("git", ["push", "-q", "origin", "main"], { cwd: worker, env: { ...process.env, GIT_AUTHOR_NAME: "t" } }).status).not.toBe(0);
	expect(existsSync(ran)).toBe(true);
	sh(worker, ["reset", "-q", "--hard", "origin/main"]);
	writeFileSync(join(worker, "g.txt"), "y");
	sh(worker, ["add", "g.txt"]);
	sh(worker, ["commit", "-q", "-m", "g"]);
	spawnSync("rm", ["-f", ran]);

	const pushed = hum(worker, "push", "-q", "origin", "main");

	expect(pushed.code).toBe(0);
	expect(existsSync(ran)).toBe(false);
	expect(sh(repo.remote, ["log", "-1", "--format=%s", "main"]).trim()).toBe("g");
});

test("hum list-ready, claim, watch, answer and read work end to end on a temp repo", () => {
	const repo = new WorkRepo();
	const worker = repo.worker("w");
	const id = repo.seed("end to end");

	expect(json(worker, "list-ready")).toEqual([{ id, title: "end to end" }]);
	expect(json(worker, "claim", id, "me")).toMatchObject({ won: true });
	expect(json(worker, "claim", id, "you")).toMatchObject({ won: false });
	expect(json(worker, "list-ready")).toEqual([]);

	expect(json(worker, "watch").changed).toBe(true);
	expect(json(worker, "watch").changed).toBe(false);

	expect(json(worker, "answer", id, "looks", "good", "--option", "approve")).toEqual({ ok: true });
	expect(json(worker, "watch").changed).toBe(true);
	expect(json(worker, "read", id).thread).toMatchObject([{ kind: "answer", text: "looks good", option: "approve" }]);
});

test("hum answer on a protected branch exits 1 and prints the remote's refusal", () => {
	const repo = new WorkRepo();
	const worker = repo.worker("w");
	const id = repo.seed("guarded");
	const hook = join(repo.remote, "hooks", "pre-receive");

	mkdirSync(join(repo.remote, "hooks"), { recursive: true });
	writeFileSync(hook, `#!/bin/sh\necho "GH006: Protected branch update failed" >&2\nexit 1\n`);
	chmodSync(hook, 0o755);

	const result = hum(worker, "answer", id, "no");

	expect(result.code).toBe(1);
	expect(result.err).toContain("Protected branch");
});

test("bad flags and a bad ttl exit 2; running outside a repo exits 1, with no stack trace", () => {
	const repo = new WorkRepo();
	const worker = repo.worker("w");
	const id = repo.seed("ttl");

	expect(hum(worker, "claim", id, "me", "--ttl", "abc").code).toBe(2);
	expect(hum(worker, "list-ready", "--nope").code).toBe(2);
	expect(json(worker, "list-ready")).toEqual([{ id, title: "ttl" }]);

	const outside = hum(tmpdir(), "list-ready");

	expect(outside.code).toBe(1);
	expect(outside.err).not.toContain("    at ");
});
