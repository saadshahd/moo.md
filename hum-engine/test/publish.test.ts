import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitIn, identityEnv } from "../src/adapters/git.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { type BundleTrust, checkBundle } from "../src/publish/bundle.ts";
import { OWNER } from "./fixtures/identity.ts";
import { tempDir } from "./fixtures/temp.ts";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";

/** A work job's clone at gather's base, publish's own clone, and a bundle of the refs the work job made. */
const outboxWorld = () => {
	const repo = new WorkRepo();
	const work = repo.worker("work");
	const publish = repo.worker("publish");
	const base = sh(work, ["rev-parse", "HEAD"]).trim();
	const trust: BundleTrust = { base, heads: [], identity: OWNER, branchPrefixes: ["hum/run/"], signs: false };

	const commit = (file: string, { by = OWNER, mode = 0o644 }: { readonly by?: typeof OWNER; readonly mode?: number } = {}) => {
		writeFileSync(join(work, file), `${file}\n`, { mode });
		sh(work, ["add", file]);
		Bun.spawnSync(["git", "commit", "-q", "-m", `add ${file}`], { cwd: work, env: { ...process.env, ...identityEnv(by) } });
	};

	const bundle = (...refs: string[]) => {
		const file = join(tempDir("outbox"), "out.bundle");

		sh(work, ["bundle", "create", "-q", file, ...refs, "--not", base]);

		return file;
	};

	const check = (file: string, more: Partial<BundleTrust> = {}) => checkBundle(gitIn(publish, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), file, { ...trust, ...more });

	sh(work, ["checkout", "-q", "-b", "hum/run/7"]);

	return { work, base, commit, bundle, check };
};

describe("an outbox's bundle", () => {
	test("a run branch of commitIdentity's commits on gather's base passes, and publish holds its refs", async () => {
		const w = outboxWorld();

		w.commit("a.md");

		expect(await w.check(w.bundle("hum/run/7"))).toEqual({ ok: true, refs: new Map([["refs/heads/hum/run/7", sh(w.work, ["rev-parse", "HEAD"]).trim()]]) });
	});

	test("a commit that credits anyone but commitIdentity is refused, naming it", async () => {
		const w = outboxWorld();

		w.commit("a.md", { by: { name: "Stranger", email: "stranger@example.com" } });

		expect(await w.check(w.bundle("hum/run/7"))).toMatchObject({ ok: false, why: expect.stringContaining("Stranger <stranger@example.com>") });
	});

	test("a commit that grows from an older commit than gather's base is refused", async () => {
		const repo = new WorkRepo();
		const work = repo.worker("work");

		repo.put({ path: "docs/later.md", content: "later\n" });

		const publish = repo.worker("publish");

		sh(work, ["fetch", "-q", "origin"]);
		sh(work, ["checkout", "-q", "-b", "hum/run/8", "origin/main~1"]);
		writeFileSync(join(work, "a.md"), "a\n");
		sh(work, ["add", "a.md"]);
		Bun.spawnSync(["git", "commit", "-q", "-m", "add a.md"], { cwd: work, env: { ...process.env, ...identityEnv(OWNER) } });

		const base = sh(work, ["rev-parse", "origin/main"]).trim();
		const file = join(tempDir("outbox"), "out.bundle");

		sh(work, ["bundle", "create", "-q", file, "hum/run/8", "--not", base]);

		expect(await checkBundle(gitIn(publish, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), file, { base, heads: [], identity: OWNER, branchPrefixes: ["hum/run/"], signs: false })).toMatchObject({
			ok: false,
			why: expect.stringContaining("neither the base gather saw nor a hum branch it handed on"),
		});
	});

	test("a ref hum does not write is refused before anything is fetched", async () => {
		const w = outboxWorld();

		w.commit("a.md");
		sh(w.work, ["branch", "main-too"]);

		expect(await w.check(w.bundle("main-too"))).toEqual({ ok: false, why: "the bundle names refs/heads/main-too, which is no ref hum writes" });
	});

	test("an executable bit is refused where the base requires signed commits, and passes where it does not", async () => {
		const w = outboxWorld();

		w.commit("run.sh", { mode: 0o755 });

		const file = w.bundle("hum/run/7");

		expect(await w.check(file, { signs: true })).toMatchObject({ ok: false, why: expect.stringContaining("run.sh (mode 100755)") });
		expect(await w.check(file)).toMatchObject({ ok: true });
	});
});
