import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { x } from "tinyexec";
import { FakeProvider } from "../src/adapters/fake.ts";
import { gitIn, push } from "../src/adapters/git.ts";
import { gitHubPullRequests, type PullRequests } from "../src/adapters/pull-requests.ts";
import type { Config } from "../src/config/load.ts";
import { openState } from "../src/state/open.ts";
import { type LandContext, land } from "../src/worker/land.ts";
import { configWith } from "./fixtures/config.ts";

const live = process.env.HUM_LIVE === "1";
const repo = process.env.HUM_GITHUB_SCRATCH ?? "saadshahd/factory-smoke";
const POLL_MS = 15_000;
const MERGE_WAIT_MS = 480_000;

if (!live) console.log(`skip live landing: set HUM_LIVE=1 to open pull requests on ${repo}, whose main requires one and the check status`);

const landing = async (config: Config, pulls: PullRequests, stamp: string) => {
	const clone = mkdtempSync(join(tmpdir(), "hum-live-landing-"));
	const git = gitIn(clone, { identity: config.hum.commitIdentity });
	const id = `live-${stamp}`;
	const branch = `${config.hum.runBranchPrefix}${id}`;
	const file = `docs/${id}.md`;
	const state = openState(mkdtempSync(join(tmpdir(), "hum-live-state-")));
	const provider = new FakeProvider().adapter();

	await gitIn(tmpdir()).raw(["clone", "-q", "--depth", "50", `https://github.com/${repo}.git`, clone]);
	await git.raw(["checkout", "-q", "-b", branch]);
	mkdirSync(join(clone, "docs"), { recursive: true });
	writeFileSync(join(clone, file), `A landing test, ${stamp}.\n`);
	await git.raw(["add", file]);
	await git.raw(["commit", "-q", "-m", `docs: ${id}`]);
	await push(git, ["origin", `HEAD:refs/heads/${branch}`]);
	state.landings.put(id, { item: id, branch, since: Date.now(), change: { paths: [file], size: 1, loosened: false, pinChanged: false } });

	const ctx: LandContext = {
		state,
		config,
		kind: "docs",
		id,
		item: { id, title: `Landing test ${stamp}`, body: "", ready: true, thread: [] },
		branch,
		base: "main",
		remote: `https://github.com/${repo}.git`,
		clone,
		dir: config.hum.itemsDir,
		git,
		checks: [],
		workSource: provider.workSource!,
		questions: provider.questions!,
		pulls,
		now: Date.now,
	};

	return { ctx, branch, cleanup: () => [clone, state.dir].forEach((dir) => rmSync(dir, { recursive: true, force: true })) };
};

const closeAndDelete = async (branch: string) => {
	await x("gh", ["pr", "close", branch, "-R", repo, "--delete-branch"], { stdin: "" });
	await x("gh", ["api", "-X", "DELETE", `repos/${repo}/git/refs/heads/${branch}`], { stdin: "" });
};

// The owner's own login may bypass the ruleset, so a push would land; hum reads the rules and opens a pull request.
test.skipIf(!live)("live: where main requires a pull request, a cleared change opens one with auto-merge that merges once the check passes; a change for the owner waits unarmed", async () => {
	const stamp = String(Date.now());
	const pulls = gitHubPullRequests(repo);
	const alone = await landing(configWith(), pulls, `${stamp}-a`);
	const owner = await landing(configWith((raw) => void (raw.hum.paths = [{ glob: "docs/**", level: "high" }])), pulls, `${stamp}-b`);

	try {
		expect(await land(alone.ctx)).toMatchObject({ outcome: "landing", detail: expect.stringContaining(`github.com/${repo}/pull/`) });
		expect(await pulls.find(alone.branch)).toMatchObject({ state: "OPEN", autoMerge: true });

		expect(await land(owner.ctx)).toMatchObject({ outcome: "landing" });
		expect(await pulls.find(owner.branch)).toMatchObject({ state: "OPEN", autoMerge: false });

		const deadline = Date.now() + MERGE_WAIT_MS;
		let result = await land(alone.ctx);

		while (result.outcome === "landing" && Date.now() < deadline) {
			await Bun.sleep(POLL_MS);
			result = await land(alone.ctx);
		}

		expect(result).toEqual({ outcome: "merged", item: alone.ctx.id });
		expect(alone.ctx.state.landings.get(alone.ctx.id)).toBeUndefined();
	} finally {
		await closeAndDelete(owner.branch);
		await closeAndDelete(alone.branch);
		alone.cleanup();
		owner.cleanup();
	}
}, MERGE_WAIT_MS + 120_000);
