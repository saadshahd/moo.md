import { type Git, isAncestor, push, type PushOutcome } from "../adapters/git.ts";
import type { FileChanges, GitHubCommits } from "../adapters/github-commits.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";

/** What a push reads: the clone's git, the base the change lands on, and the remote's rules and branches on GitHub. */
export type PushContext = {
	readonly git: Git;
	readonly base: string;
	readonly pulls: PullRequests | undefined;
	readonly commits: GitHubCommits | undefined;
};

/** A push that landed, at the commit the branch now holds. */
type Signed = { readonly kind: "pushed"; readonly sha: string } | Exclude<PushOutcome, { kind: "pushed" }>;

/** One object `git cat-file --batch` printed: `<oid> <type> <size>`, a newline, the bytes and a newline. */
const BATCH_HEADER = /^([0-9a-f]+) blob (\d+)$/;

const NEWLINE = 0x0a;

/** Each blob's bytes in base64 by its oid, from what `git cat-file --batch` printed; anything but a blob throws. */
const blobsOf = (batch: Buffer): ReadonlyMap<string, string> => {
	const blobs = new Map<string, string>();

	for (let at = 0; at < batch.length; ) {
		const end = batch.indexOf(NEWLINE, at);
		const header = batch.toString("utf8", at, end);
		const [, oid, size] = BATCH_HEADER.exec(header) ?? [];

		if (oid === undefined) throw new Error(`git cat-file --batch printed ${header}, not a blob`);

		const stop = end + 1 + Number(size);

		blobs.set(oid, batch.subarray(end + 1, stop).toString("base64"));
		at = stop + 1;
	}

	return blobs;
};

/** The files `to` adds, changes and deletes against `from`, as GitHub's commit takes them, every blob read by one git process. */
const changesBetween = async (git: Git, from: string, to: string): Promise<FileChanges> => {
	const fields = (await git.raw(["diff", "--raw", "--no-abbrev", "--no-renames", "-z", from, to])).split("\0").filter(Boolean);

	const changed = fields.flatMap((meta, at) => {
		const [, , , blob = "", status = ""] = meta.split(" ");

		return at % 2 === 0 ? [{ blob, status, path: fields[at + 1] ?? "" }] : [];
	});

	const kept = changed.filter(({ status }) => status !== "D");
	const blobs = kept.length === 0 ? new Map<string, string>() : blobsOf(await git.bytes(["cat-file", "--batch"], `${kept.map(({ blob }) => blob).join("\n")}\n`));

	return {
		additions: kept.map(({ path, blob }) => ({ path, contents: blobs.get(blob) ?? "" })),
		deletions: changed.filter(({ status }) => status === "D").map(({ path }) => ({ path })),
	};
};

/** The commit message: the newest commit's subject, and each commit's subject below it when several make the change. */
const messageOf = async (git: Git, from: string, to: string): Promise<{ readonly headline: string; readonly body: string }> => {
	const subjects = (await git.raw(["log", "--reverse", "--format=%s", `${from}..${to}`])).split("\n").filter(Boolean);

	return {
		headline: (await git.raw(["log", "-1", "--format=%s", to])).trim(),
		body: subjects.length > 1 ? subjects.map((subject) => `- ${subject}`).join("\n") : (await git.raw(["log", "-1", "--format=%b", to])).trim(),
	};
};

/** Whether commits that reach the base must carry a signature GitHub verifies, as its rules say. */
export const signsCommits = async ({ pulls, base }: Pick<PushContext, "pulls" | "base">): Promise<boolean> => pulls !== undefined && (await pulls.rules(base)).requiresSignatures;

const requireCommits = ({ commits, base }: Pick<PushContext, "commits" | "base">): GitHubCommits => {
	if (!commits) throw new Error(`${base} requires signed commits, and hum has no GitHub client to make them through`);

	return commits;
};

/** The branch GitHub makes each commit on, so the branch itself moves only to a commit whose tree is checked. */
const scratchBranch = (branch: string): string => `${branch}-signing`;

/**
 * Puts the tree of `from` on `branch` as one commit that GitHub makes on `parent`, and so signs. The branch must stand
 * at `parent`, or not exist; with `replace`, a branch elsewhere is moved to the new commit. A commit through the API
 * carries no file mode or link, so GitHub makes it on a scratch branch first, and a tree that comes back different
 * throws before the branch moves.
 */
export const commitSigned = async (ctx: PushContext, { from, parent, branch, replace }: { readonly from: string; readonly parent: string; readonly branch: string; readonly replace: boolean }): Promise<Signed> => {
	const commits = requireCommits(ctx);
	const remote = await commits.head(branch);

	if (remote !== undefined && remote !== parent && !replace) return { kind: "conflict" };

	const scratch = scratchBranch(branch);
	const created = await commits.createBranch(scratch, parent);
	const placed = created.kind === "conflict" ? await commits.moveBranch(scratch, parent, true) : created;

	if (placed.kind !== "done") return placed;

	try {
		const made = await commits.commitOnBranch({ branch: scratch, expected: parent, ...(await messageOf(ctx.git, parent, from)), files: await changesBetween(ctx.git, parent, from) });

		if (made.kind !== "done") return made;

		const tree = (await ctx.git.raw(["rev-parse", `${from}^{tree}`])).trim();

		if (made.value.tree !== tree) throw new Error(`GitHub's commit ${made.value.oid} holds another tree than ${from}, so ${branch} was left where it was: the change holds an executable bit, a link or a submodule, which a commit through GitHub's API cannot carry`);

		const moved = remote === undefined ? await commits.createBranch(branch, made.value.oid) : await commits.moveBranch(branch, made.value.oid, remote !== parent);

		return moved.kind === "done" ? { kind: "pushed", sha: made.value.oid } : moved;
	} finally {
		await commits.deleteBranch(scratch);
	}
};

/**
 * Pushes HEAD to the run branch. Where the base's rules ask for signed commits, GitHub makes one commit of the change,
 * on the branch's own tip when HEAD grew from it, else on where HEAD left the base, and HEAD moves to it with its tree
 * unchanged. Elsewhere git force-pushes.
 */
export const pushRunBranch = async (ctx: PushContext, branch: string): Promise<PushOutcome> => {
	const { git, base } = ctx;

	if (!(await signsCommits(ctx))) return push(git, ["--force", "origin", `HEAD:refs/heads/${branch}`]);

	const head = (await git.raw(["rev-parse", "HEAD"])).trim();
	const remote = await requireCommits(ctx).head(branch);

	if (remote === head) return { kind: "pushed" };

	await git.raw(["fetch", "-q", "origin", base, ...(remote === undefined ? [] : [branch])]);

	const grewFrom = remote !== undefined && (await isAncestor(git, { ancestor: remote, descendant: head }));
	const parent = grewFrom ? remote : (await git.raw(["merge-base", head, `origin/${base}`])).trim();
	const signed = await commitSigned(ctx, { from: head, parent, branch, replace: true });

	if (signed.kind !== "pushed") return signed;

	await git.raw(["fetch", "-q", "origin", branch]);
	await git.raw(["reset", "-q", signed.sha]);

	return { kind: "pushed" };
};

/** Moves the base to HEAD, as a fast-forward: through GitHub's API where the base's rules ask for signed commits, else with git. */
export const pushBase = async (ctx: PushContext): Promise<PushOutcome> => {
	if (!(await signsCommits(ctx))) return push(ctx.git, ["origin", `HEAD:refs/heads/${ctx.base}`]);

	const moved = await requireCommits(ctx).moveBranch(ctx.base, (await ctx.git.raw(["rev-parse", "HEAD"])).trim(), false);

	return moved.kind === "done" ? { kind: "pushed" } : moved;
};

/** Pushes `<sha>:refs/heads/<branch>` refspecs of single commits, each signed by GitHub where the base's rules ask for it. */
export const pushCommits = async (ctx: PushContext, refspecs: readonly string[]): Promise<PushOutcome> => {
	if (!(await signsCommits(ctx))) return push(ctx.git, ["origin", ...refspecs]);

	for (const refspec of refspecs) {
		const [from = "", to = ""] = refspec.split(":");
		const signed = await commitSigned(ctx, { from, parent: (await ctx.git.raw(["rev-parse", `${from}^`])).trim(), branch: to.replace(/^refs\/heads\//, ""), replace: false });

		if (signed.kind !== "pushed") return signed;
	}

	return { kind: "pushed" };
};
