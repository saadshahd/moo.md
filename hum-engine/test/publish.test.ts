import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { type GitIdentity, gitIn, identityEnv } from "../src/adapters/git.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { type BundleTrust, checkBundle } from "../src/publish/bundle.ts";
import { fetchedPublishRepo } from "../src/publish/publisher.ts";
import { rebaseOnto } from "../src/worker/land.ts";
import { configWith } from "./fixtures/config.ts";
import { APP_COMMIT_ENV } from "./fixtures/fake-github.ts";
import { OWNER } from "./fixtures/identity.ts";
import { tempDir } from "./fixtures/temp.ts";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";

const STRANGER: GitIdentity = { name: "Stranger", email: "stranger@example.com" };

/** A work job's clone at gather's base, publish's own clone, and a bundle of the refs the work job made. */
const outboxWorld = () => {
	const repo = new WorkRepo();
	const work = repo.worker("work");
	const publish = repo.worker("publish");
	const base = sh(work, ["rev-parse", "HEAD"]).trim();
	const trust: BundleTrust = { base, heads: [], identity: OWNER, branchPrefixes: ["hum/run/"], signs: false };

	const commit = (file: string, { by = OWNER, committedBy = by, mode = 0o644 }: { readonly by?: GitIdentity; readonly committedBy?: GitIdentity; readonly mode?: number } = {}) => {
		writeFileSync(join(work, file), `${file}\n`, { mode });
		sh(work, ["add", file]);
		Bun.spawnSync(["git", "commit", "-q", "-m", `add ${file}`], { cwd: work, env: { ...process.env, ...identityEnv(committedBy), GIT_AUTHOR_NAME: by.name, GIT_AUTHOR_EMAIL: by.email } });
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

	test.each([
		["written", { by: STRANGER }],
		["committed", { committedBy: STRANGER }],
	])("a commit %s by anyone but commitIdentity, with no commit of theirs handed on, is refused, naming them", async (_, by) => {
		const w = outboxWorld();

		w.commit("a.md", by);

		expect(await w.check(w.bundle("hum/run/7"))).toMatchObject({ ok: false, why: expect.stringContaining("Stranger <stranger@example.com>") });
	});

	test("a run branch GitHub's API made, rebased onto the base gather saw, passes: the App stays its author and commitIdentity commits it", async () => {
		const repo = new WorkRepo();
		const work = repo.worker("work");

		sh(work, ["checkout", "-q", "-b", "hum/run/9"]);
		writeFileSync(join(work, "a.md"), "a\n");
		sh(work, ["add", "a.md"]);
		Bun.spawnSync(["git", "commit", "-q", "-m", "add a.md"], { cwd: work, env: { ...process.env, ...APP_COMMIT_ENV } });
		sh(work, ["push", "-q", "origin", "hum/run/9"]);

		const handedOn = sh(work, ["rev-parse", "HEAD"]).trim();

		repo.put({ path: "docs/later.md", content: "later\n" });
		sh(work, ["fetch", "-q", "origin"]);

		const base = sh(work, ["rev-parse", "origin/main"]).trim();
		const git = gitIn(work, { identity: OWNER, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

		expect(await rebaseOnto({ git, clone: work, env: {}, checks: [], config: configWith(), base: "main" }, base)).toBeUndefined();
		expect(sh(work, ["log", "-1", "--format=%an <%ae> | %cn <%ce>"]).trim()).toBe(`app[bot] <app@users.noreply.github.com> | ${OWNER.name} <${OWNER.email}>`);

		const file = join(tempDir("outbox"), "out.bundle");

		sh(work, ["bundle", "create", "-q", file, "hum/run/9", "--not", base]);

		expect(await checkBundle(gitIn(repo.worker("publish"), { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS }), file, { base, heads: [handedOn], identity: OWNER, branchPrefixes: ["hum/run/"], signs: true })).toMatchObject({ ok: true });
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

test("passes that fetch publish's repo at once, each time the base moved, all end holding the base's head", async () => {
	const repo = new WorkRepo();
	const publisher = { repo: join(tempDir("publish"), "repo"), remote: repo.remote, config: configWith(), base: "main" };
	const fetchedHead = async () => (await (await fetchedPublishRepo(publisher)).raw(["rev-parse", "origin/main"])).trim();

	for (const round of ["one", "two", "three"]) {
		repo.put({ path: `docs/${round}.md`, content: `${round}\n` });

		const heads = await Promise.all(Array.from({ length: 4 }, fetchedHead));

		expect(new Set(heads)).toEqual(new Set([sh(repo.remote, ["rev-parse", "main"]).trim()]));
	}
});
