import { type Git, isAncestor, push, type PushOutcome } from "../adapters/git.ts";
import type { FileChanges, GitHubCommits } from "../adapters/github-commits.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";

/** What a push reads: the clone and its git, the base the change lands on, and the remote's rules and branches on GitHub. */
export type PushContext = {
	readonly git: Git;
	readonly clone: string;
	readonly base: string;
	readonly pulls: PullRequests | undefined;
	readonly commits: GitHubCommits | undefined;
};

/** A push that landed, at the commit the branch now holds. */
type Signed = { readonly kind: "pushed"; readonly sha: string } | Exclude<PushOutcome, { kind: "pushed" }>;

/** The bytes of one blob, in base64; git hands them back as written, binary or not. */
const blobBase64 = async (clone: string, spec: string): Promise<string> => {
	const proc = Bun.spawn(["git", "cat-file", "blob", spec], { cwd: clone, stdout: "pipe", stderr: "pipe" });
	const [bytes, said, code] = await Promise.all([new Response(proc.stdout).arrayBuffer(), new Response(proc.stderr).text(), proc.exited]);

	if (code !== 0) throw new Error(`git cat-file blob ${spec} exited ${code}: ${said.trim()}`);

	return Buffer.from(bytes).toString("base64");
};

/** The files `to` adds, changes and deletes against `from`, as GitHub's commit takes them. */
const changesBetween = async ({ git, clone }: Pick<PushContext, "git" | "clone">, from: string, to: string): Promise<FileChanges> => {
	const fields = (await git.raw(["diff", "--no-renames", "--name-status", "-z", from, to])).split("\0").filter(Boolean);
	const changed = fields.flatMap((status, at) => (at % 2 === 0 ? [{ status, path: fields[at + 1] ?? "" }] : []));

	return {
		additions: await Promise.all(changed.filter(({ status }) => status !== "D").map(async ({ path }) => ({ path, contents: await blobBase64(clone, `${to}:${path}`) }))),
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

const githubCommits = ({ commits, base }: Pick<PushContext, "commits" | "base">): GitHubCommits => {
	if (!commits) throw new Error(`${base} requires signed commits, and hum has no GitHub client to make them through`);

	return commits;
};

/** The branch hum builds a replacement commit on, so the branch itself moves once, from its old commit to the new. */
const scratchBranch = (branch: string): string => `${branch}-signing`;

/**
 * Puts the tree of `from` on `branch` as one commit that GitHub makes on `parent`, and so signs. The branch must stand
 * at `parent`, or not exist; with `replace`, a branch elsewhere is moved to the new commit. A commit through the API
 * carries no file mode or link, so a tree that comes back different throws.
 */
export const commitSigned = async (ctx: PushContext, { from, parent, branch, replace }: { readonly from: string; readonly parent: string; readonly branch: string; readonly replace: boolean }): Promise<Signed> => {
	const commits = githubCommits(ctx);
	const remote = await commits.head(branch);

	if (remote !== undefined && remote !== parent && !replace) return { kind: "conflict" };

	const target = remote === undefined || remote === parent ? branch : scratchBranch(branch);

	if (target !== branch || remote === undefined) {
		const created = await commits.createBranch(target, parent);
		const placed = created.kind === "conflict" && target !== branch ? await commits.moveBranch(target, parent, true) : created;

		if (placed.kind !== "done") return placed;
	}

	const made = await commits.commitOnBranch({ branch: target, expected: parent, ...(await messageOf(ctx.git, parent, from)), files: await changesBetween(ctx, parent, from) });

	if (made.kind !== "done") return made;

	if (target !== branch) {
		const moved = await commits.moveBranch(branch, made.value.oid, true);

		await commits.deleteBranch(target);

		if (moved.kind !== "done") return moved;
	}

	const tree = (await ctx.git.raw(["rev-parse", `${from}^{tree}`])).trim();

	if (made.value.tree !== tree) throw new Error(`GitHub's commit ${made.value.oid} on ${branch} holds another tree than ${from}: the change holds an executable bit, a link or a submodule, which a commit through GitHub's API cannot carry`);

	return { kind: "pushed", sha: made.value.oid };
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
	const remote = await githubCommits(ctx).head(branch);

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

	const moved = await githubCommits(ctx).moveBranch(ctx.base, (await ctx.git.raw(["rev-parse", "HEAD"])).trim(), false);

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
