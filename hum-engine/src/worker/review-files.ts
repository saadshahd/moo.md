import type { Item } from "../adapter-api.ts";
import type { Git } from "../adapters/git.ts";
import { type HumConfig, isInsideRepo } from "../config/schema.ts";
import { type ReadFile, reviewPaths } from "../decide/review.ts";
import { isStrictPath } from "../decide/risk.ts";

/** A `git ls-tree -z` entry of a regular file, capturing its blob. */
const REGULAR_FILE = /^100(?:644|755) blob ([0-9a-f]+)\t/;

type Policy = Pick<HumConfig, "reviewReads" | "strictPaths">;

/** Why a review may not read a named path, judged before git is asked: the first rule that refuses it. */
const NAME_RULES = [
	{ refuses: (path: string) => !isInsideRepo(path), why: "it is not a path inside the repo" },
	{ refuses: (path: string, policy: Policy) => isStrictPath(path, policy), why: "strictPaths marks it as data or secrets" },
] as const satisfies readonly { refuses: (path: string, policy: Policy) => boolean; why: string }[];

/** What a review reads beside the diff, or why it cannot: the first named file it may not read, and the reason. */
export type ReviewFiles = { readonly ok: true; readonly files: readonly ReadFile[] } | { readonly ok: false; readonly why: string };

/** What a run that reviews nothing reads beside its prompt. */
export const NO_REVIEW_FILES: ReviewFiles = { ok: true, files: [] };

/** A named file the review may read, or why it may not. */
type Read = { readonly ok: true; readonly file: ReadFile } | { readonly ok: false; readonly why: string };

const refusedFor = (why: string): Read => ({ ok: false, why });

/** One named file's bytes as `ref` holds it, or why the review may not read it. */
const readOne = async (git: Git, ref: string, path: string, policy: Policy): Promise<Read> => {
	const refused = NAME_RULES.find(({ refuses }) => refuses(path, policy));

	if (refused) return refusedFor(refused.why);

	const entry = await git.raw(["--literal-pathspecs", "ls-tree", "-z", ref, "--", path]);

	if (entry === "") return refusedFor(`git does not track it on ${ref}`);

	const blob = REGULAR_FILE.exec(entry)?.[1];

	return blob === undefined ? refusedFor("it is not a regular file") : { ok: true, file: { path, bytes: await git.bytes(["cat-file", "blob", blob]) } };
};

/**
 * The files an item's review reads, as `ref` holds them: the repo's own, then those the item names. Each must be a
 * regular file git tracks there and strictPaths leaves alone; the first one that is not fails the read, naming it.
 */
export const readReviewFiles = async (git: Git, ref: string, item: Pick<Item, "body">, policy: Policy): Promise<ReviewFiles> => {
	const paths = reviewPaths(item, policy);
	const reads = await Promise.all(paths.map((path) => readOne(git, ref, path, policy)));
	const refused = reads.findIndex((read) => !read.ok);
	const read = reads[refused];

	return read && !read.ok ? { ok: false, why: `the review cannot read ${paths[refused]}: ${read.why}` } : { ok: true, files: reads.flatMap((each) => (each.ok ? [each.file] : [])) };
};
