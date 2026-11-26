import type { Item } from "../adapter-api.ts";
import { type Git, readBlobs } from "../adapters/git.ts";
import { type HumConfig, isInsideRepo } from "../config/schema.ts";
import { type ReadFile, reviewPaths } from "../decide/review.ts";
import { isStrictPath } from "../decide/risk.ts";

/** A `git ls-tree -z` entry of a regular file, capturing its blob. */
const REGULAR_FILE = /^100(?:644|755) blob ([0-9a-f]+)\t/;

type Policy = Pick<HumConfig, "reviewReads" | "strictPaths">;

/** Why a review may not read a path by its name alone, judged before git is asked: the first rule that refuses it. */
const NAME_RULES = [
	{ refuses: (path: string) => !isInsideRepo(path), why: "it is not a path inside the repo" },
	{ refuses: (path: string, policy: Policy) => isStrictPath(path, policy), why: "strictPaths marks it as data or secrets" },
] as const satisfies readonly { refuses: (path: string, policy: Policy) => boolean; why: string }[];

/** What a review reads beside the diff, or why it cannot: the first file it may not read, and the reason. */
export type ReviewFiles = { readonly ok: true; readonly files: readonly ReadFile[] } | { readonly ok: false; readonly why: string };

/** What a run that reviews nothing reads beside its prompt. */
export const NO_REVIEW_FILES: ReviewFiles = { ok: true, files: [] };

/** A file the review may read, by its blob as the ref holds it. */
type Readable = { readonly path: string; readonly blob: string };

/** A path the review may not read, and why. */
type Refused = { readonly path: string; readonly why: string };

type Found = Readable | Refused;

const isRefused = (found: Found): found is Refused => "why" in found;

const isReadable = (found: Found): found is Readable => "blob" in found;

const nameRefusal = (path: string, policy: Policy): string | undefined => NAME_RULES.find(({ refuses }) => refuses(path, policy))?.why;

/** One `git ls-tree -z` entry as the review finds it: a regular file its name leaves readable, or why the review may not read it. */
const foundIn = (entry: string, policy: Policy): Found => {
	const path = entry.slice(entry.indexOf("\t") + 1);
	const why = nameRefusal(path, policy);
	const blob = REGULAR_FILE.exec(entry)?.[1];

	if (why !== undefined) return { path, why };

	return blob === undefined ? { path, why: "it is not a regular file" } : { path, blob };
};

/** What a named path holds on `ref`: the file it names, or every file git tracks under the folder it names, in git's order; or why the review may not read it. */
const foundAt = async (git: Git, ref: string, path: string, policy: Policy): Promise<readonly Found[]> => {
	const why = nameRefusal(path, policy);

	if (why !== undefined) return [{ path, why }];

	const entries = (await git.raw(["--literal-pathspecs", "ls-tree", "-r", "-z", ref, "--", path])).split("\0").filter(Boolean);

	return entries.length === 0 ? [{ path, why: `git does not track it on ${ref}` }] : entries.map((entry) => foundIn(entry, policy));
};

/** Each path once, at its first place. */
const firstOfEach = (found: readonly Found[]): Found[] => [...found.reduce((first, each) => (first.has(each.path) ? first : first.set(each.path, each)), new Map<string, Found>()).values()];

/**
 * The files an item's review reads, as `ref` holds them: the repo's own, then those the item names, a folder standing for
 * every file git tracks under it. Each must be a regular file git tracks there and strictPaths leaves alone; the first one
 * that is not fails the read, naming it.
 */
export const readReviewFiles = async (git: Git, ref: string, item: Pick<Item, "body">, policy: Policy): Promise<ReviewFiles> => {
	const found = firstOfEach((await Promise.all(reviewPaths(item, policy).map((path) => foundAt(git, ref, path, policy)))).flat());
	const refused = found.find(isRefused);

	if (refused) return { ok: false, why: `the review cannot read ${refused.path}: ${refused.why}` };

	const readable = found.filter(isReadable);
	const blobs = await readBlobs(git, readable.map(({ blob }) => blob));

	return { ok: true, files: readable.map(({ path, blob }) => ({ path, bytes: blobs.get(blob) ?? Buffer.alloc(0) })) };
};
