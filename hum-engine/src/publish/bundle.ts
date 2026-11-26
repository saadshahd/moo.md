import type { Git, GitIdentity } from "../adapters/git.ts";
import { uncarriedChange } from "../worker/signed-push.ts";

/** Where publish keeps the refs it read from an outbox's bundle, apart from every ref of its own. */
export const OUTBOX_REFS = "refs/hum/outbox/";

/** The ref an item's evidence is kept on; its tip is one commit with no parent. */
export const EVIDENCE_REFS = "refs/hum/evidence/";

/** What publish trusts a bundle against: what gather handed on and the config at gather's base. */
export type BundleTrust = {
	/** The base commit gather saw. */
	readonly base: string;
	/** The hum branch heads gather put in the inbox. */
	readonly heads: readonly string[];
	/** The owner's commitIdentity in the config at `base`. */
	readonly identity: GitIdentity;
	/** The branch prefixes hum writes, from the config at `base`: run branches and the owner's own. */
	readonly branchPrefixes: readonly string[];
	/** The base's rules require signed commits, so a branch goes through GitHub's API, which carries no file mode or link. */
	readonly signs: boolean;
};

/** A bundle's refs as the work job named them, each at its tip. */
export type BundleRefs = ReadonlyMap<string, string>;

export type BundleCheck = { readonly ok: true; readonly refs: BundleRefs } | { readonly ok: false; readonly why: string };

const FIELD = "\u001f";

/** One new commit: its sha, its parents, its author and its committer. */
const COMMIT_FORMAT = ["%H", "%P", "%an", "%ae", "%cn", "%ce"].join("%x1f");

/** A commit's author as `newCommits` names it. */
const AUTHOR_FORMAT = "%an <%ae>";

const isAllowedRef = (ref: string, { branchPrefixes }: BundleTrust): boolean => ref.startsWith(EVIDENCE_REFS) || branchPrefixes.some((prefix) => ref.startsWith(`refs/heads/${prefix}`));

const refsOf = async (git: Git, bundle: string): Promise<Map<string, string>> =>
	new Map(
		(await git.raw(["bundle", "list-heads", bundle]))
			.split("\n")
			.filter(Boolean)
			.map((line) => {
				const [sha = "", ref = ""] = line.split(" ");

				return [ref, sha] as const;
			}),
	);

type NewCommit = { readonly sha: string; readonly parents: readonly string[]; readonly author: string; readonly committer: string };

/** The commits the tips reach that neither gather's base nor an inbox head reaches. */
const newCommits = async (git: Git, tips: readonly string[], trust: BundleTrust): Promise<NewCommit[]> =>
	(await git.raw(["log", `--format=${COMMIT_FORMAT}`, ...tips, "--not", trust.base, ...trust.heads]))
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const [sha = "", parents = "", authorName, authorEmail, committerName, committerEmail] = line.split(FIELD);

			return { sha, parents: parents.split(" ").filter(Boolean), author: `${authorName} <${authorEmail}>`, committer: `${committerName} <${committerEmail}>` };
		});

/**
 * The authors of the commits the inbox heads reach past gather's base. A rebase keeps each commit's author, so a hum
 * branch GitHub's API made and the work job rebased stays the GitHub App's.
 */
const handedOnAuthors = async (git: Git, trust: BundleTrust): Promise<string[]> =>
	trust.heads.length === 0 ? [] : (await git.raw(["log", `--format=${AUTHOR_FORMAT}`, ...trust.heads, "--not", trust.base])).split("\n").filter(Boolean);

/**
 * Why the commits break the owner's rules: commitIdentity commits each and writes each, unless a rebase kept the
 * author of a commit gather handed on; each parent is another new commit, gather's base or an inbox head. Only an
 * evidence ref's tip has no parent. The identity check stops a commit made under the wrong name by mistake; a hostile
 * work job writes any name it likes, so the walls against it are the ref check and publish placing the change from
 * its own diff and config.
 */
const commitFault = (commits: readonly NewCommit[], evidenceTips: ReadonlySet<string>, trust: BundleTrust, handedOn: readonly string[]): string | undefined => {
	const owner = `${trust.identity.name} <${trust.identity.email}>`;
	const authors = new Set([owner, ...handedOn]);
	const known = new Set([trust.base, ...trust.heads, ...commits.map(({ sha }) => sha)]);

	for (const { sha, parents, author, committer } of commits) {
		if (committer !== owner) return `commit ${sha} is committed by ${committer}, not by commitIdentity ${owner}`;

		if (!authors.has(author)) return `commit ${sha} is by ${author}, who is neither commitIdentity ${owner} nor the author of a commit gather handed on`;

		if (parents.length === 0 && !evidenceTips.has(sha)) return `commit ${sha} has no parent and is no evidence ref's tip`;

		const stranger = parents.find((parent) => !known.has(parent));

		if (stranger !== undefined) return `commit ${sha} grows from ${stranger}, which is neither the base gather saw nor a hum branch it handed on`;
	}

	return undefined;
};

/**
 * Reads an outbox's bundle into publish's repo under `OUTBOX_REFS` and checks it before any write: every ref is one
 * hum writes, every object passes git's own check, commitIdentity commits every new commit and writes it unless a
 * rebase kept a handed-on commit's author, every new commit grows from gather's base or a hum branch it handed on,
 * and on a base that requires signed commits no branch changes a mode GitHub's API cannot carry. The repo must already hold gather's base and heads.
 */
export const checkBundle = async (git: Git, bundle: string, trust: BundleTrust): Promise<BundleCheck> => {
	const verified = await git.run(["bundle", "verify", "-q", bundle]);

	if (verified.code !== 0) return { ok: false, why: `the bundle does not verify against what gather handed on: ${verified.stderr.trim()}` };

	const refs = await refsOf(git, bundle);
	const foreign = [...refs.keys()].find((ref) => !isAllowedRef(ref, trust));

	if (foreign !== undefined) return { ok: false, why: `the bundle names ${foreign}, which is no ref hum writes` };

	await git.raw(["-c", "transfer.fsckObjects=true", "fetch", "-q", "--no-tags", bundle, ...[...refs.keys()].map((ref) => `+${ref}:${OUTBOX_REFS}${ref.slice("refs/".length)}`)]);

	const evidenceTips = new Set([...refs].flatMap(([ref, sha]) => (ref.startsWith(EVIDENCE_REFS) ? [sha] : [])));
	const fault = commitFault(await newCommits(git, [...refs.values()], trust), evidenceTips, trust, await handedOnAuthors(git, trust));

	if (fault !== undefined) return { ok: false, why: fault };

	const branches = [...refs].filter(([ref]) => !ref.startsWith(EVIDENCE_REFS));
	const carried = trust.signs ? await Promise.all(branches.map(async ([ref, tip]) => ({ ref, file: await uncarriedChange(git, tip, trust.base) }))) : [];
	const refused = carried.find(({ file }) => file !== undefined);

	return refused?.file ? { ok: false, why: `${refused.ref} changes ${refused.file.path} (mode ${refused.file.mode}), which a commit through GitHub's API cannot carry` } : { ok: true, refs };
};
