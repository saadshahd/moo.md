import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";

const MAIN = join(import.meta.dir, "..", "src", "cli", "main.ts");

const hum = (cwd: string, ...args: string[]) => {
	const result = spawnSync("bun", [MAIN, ...args], { cwd, encoding: "utf8" });

	return { code: result.status, out: result.stdout, err: result.stderr };
};

/** What the worker will read at once: the ids in the inbox folder, the empty wake of a seen change included. */
const inboxOf = (cwd: string): string[] => {
	const folder = join(cwd, ".git", "hum", "inbox");

	return readdirSync(folder).map((name) => readFileSync(join(folder, name), "utf8"));
};

const json = (cwd: string, ...args: string[]) => {
	const result = hum(cwd, ...args);

	if (result.code !== 0) throw new Error(`hum ${args.join(" ")} exited ${result.code}: ${result.err}`);

	return JSON.parse(result.out);
};

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

	const first = json(worker, "watch");

	expect(first.changed).toBe(true);
	expect(json(worker, "watch")).toEqual(first);

	expect(json(worker, "answer", id, "looks", "good", "--option", "approve")).toEqual({ ok: true });
	expect(json(worker, "watch", "--since", first.token).changed).toBe(true);
	expect(inboxOf(worker)).toContain(id);
	expect(json(worker, "read", id).thread).toMatchObject([{ kind: "answer", text: "looks good", option: "approve" }]);
});

test("hum claim without --ttl lasts claimExpirySeconds from the repo's hum.json", () => {
	const repo = new WorkRepo();
	const worker = repo.worker("w");
	const id = repo.seed("ttl");

	mkdirSync(join(worker, ".hum"), { recursive: true });
	writeFileSync(join(worker, ".hum", "hum.json"), JSON.stringify({ claimExpirySeconds: 120 }));

	const claimed = json(worker, "claim", id, "me");

	expect(claimed.claim.expiresAt - Date.now()).toBeGreaterThan(100_000);
	expect(claimed.claim.expiresAt - Date.now()).toBeLessThanOrEqual(120_000);
});

test("an unknown op, an unknown flag and a bad ttl exit 2; a failure outside a repo exits 1 with no stack trace", () => {
	const unknownOp = hum(process.cwd(), "nope");

	expect(unknownOp.code).toBe(2);
	expect(unknownOp.err).toContain("list-ready");
	expect(hum(process.cwd(), "claim", "an-item", "me", "--ttl", "abc").code).toBe(2);
	expect(hum(process.cwd(), "list-ready", "--nope").code).toBe(2);

	const outside = hum(tmpdir(), "list-ready");

	expect(outside.code).toBe(1);
	expect(outside.err).not.toContain("    at ");
});

test("a repo that runs only in CI leaves no wake file for an answer or a changed watch", () => {
	const repo = new WorkRepo();
	const worker = repo.worker("w");
	const id = repo.seed("ci only");

	mkdirSync(join(worker, ".hum"), { recursive: true });
	writeFileSync(join(worker, ".hum", "hum.json"), JSON.stringify({ runPlaces: ["ci"] }));

	json(worker, "watch");
	json(worker, "answer", id, "go", "--option", "approve");

	expect(existsSync(join(worker, ".git", "hum", "inbox")) ? readdirSync(join(worker, ".git", "hum", "inbox")) : []).toEqual([]);
});
