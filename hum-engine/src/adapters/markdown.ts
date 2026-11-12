import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import slugify from "@sindresorhus/slugify";
import PQueue from "p-queue";
import pRetry from "p-retry";
import { type Adapter, type AdapterContext, type Claim, type Item, ITEM_ID_LENGTH, ItemId, type ItemRef, PermanentError, type ThreadEntry, type Watch } from "../adapter-api.ts";
import type { MergeMethod } from "../config/schema.ts";
import { parseArgument } from "./argument.ts";
import { claimCommitMessage, claimer, claimOfCommit, isLive } from "./claim.ts";
import { type GitIdentity, gitIn, push, PushRefused, readOrAbsent } from "./git.ts";
import { appendEntry, type ItemFile, newItemFile, parseItemFile, READY_STATE } from "./item-file.ts";
import { answerMarker, followUpBody, followUpKey, questionText } from "./marked.ts";
import { type CommitLanded, landOwnerCommit } from "./owner-commit.ts";
import type { PullRequests } from "./pull-requests.ts";

const ITEM_EXTENSION = ".md";
const BASE_REF = "refs/hum/base";
const CLAIMS_REF = "refs/hum/claims";
const NO_BASE_TOKEN = "none";

/** The remote the adapter fetches from and pushes to. */
const REMOTE = "origin";
const WRITE_RACE_BACKOFF_MS = 50;
const FOLLOW_UP_SLUG_LENGTH = 40;

export type MarkdownOptions = {
	/** A clone of the work repo. The adapter never touches its working tree or its branches. */
	readonly repo: string;
	/** A claim is the first push of the branch this prefix and the item id make. */
	readonly claimPrefix: string;
	/** The folder of the repo that holds the item files. */
	readonly itemsDir: string;
	/** The author and committer of the commits the adapter makes. */
	readonly identity: GitIdentity;
	/** Retries of a write that another writer's push beat. */
	readonly writeRaceRetries: number;
	/** Item files read at once; each read is a git process. */
	readonly itemReadsAtOnce: number;
	/** The branch whose items folder holds the items; every write is pushed to it. */
	readonly base?: string;
	/** Pull requests of the repo on GitHub. An owner's answer goes through one when the base requires it. */
	readonly pulls?: PullRequests;
	readonly mergeMethod: MergeMethod;
	/** The branch prefix of a pull request that lands an owner's answer. */
	readonly ownerBranchPrefix: string;
	/** The owner's `commandTimeoutSeconds` in milliseconds: the limit of every git call the adapter makes. */
	readonly timeoutMs: number;
};

type StandingClaim = { readonly claim: Claim; readonly sha: string };

type FileChange = { readonly path: string; readonly content: string };

/**
 * The remote as the last fetch saw it, with this adapter's own pushes since laid over it. Every read until the next
 * fetch shares it: `listReady` fetches, and so does a read after a push that did not land as written.
 */
type View = {
	/** The standing claims, read from the fetched refs at most once. */
	claims?: Promise<ReadonlyMap<string, StandingClaim>>;
	/** Each item file's source by path, read at most once. */
	readonly sources: Map<string, Promise<string | undefined>>;
};

/** How a write reached the base: a push of its own commit, or a pull request that merges it as a commit of GitHub's. */
type Landed = Exclude<CommitLanded["via"], "conflict">;

/** Another writer moved the base branch between this write's read and its push. */
class LostRace extends Error {
	override name = "LostRace";
}

const isItemFileName = (name: string): boolean => name.endsWith(ITEM_EXTENSION);

const followUpId = (from: string, title: string): string =>
	[from, slugify(title).slice(0, FOLLOW_UP_SLUG_LENGTH) || "follow-up", followUpKey(title)].join("-").slice(0, ITEM_ID_LENGTH);

/**
 * The default work source: markdown files in the items folder on the base branch of a git remote.
 * Every write is a commit built from git plumbing and pushed with hooks off, so the clone's working tree
 * and branches stay untouched. A claim is the first push of its claim branch; a renewal is a fast-forward on top.
 */
export const markdownAdapter = ({ repo, claimPrefix, itemsDir, identity, writeRaceRetries, itemReadsAtOnce, pulls, mergeMethod, ownerBranchPrefix, timeoutMs, base = "main" }: MarkdownOptions, { report, now }: AdapterContext) => {
	const git = gitIn(repo, { identity, timeoutMs });
	const pathOf = (id: string): string => `${itemsDir}/${id}${ITEM_EXTENSION}`;
	const baseBranch = `refs/heads/${base}`;
	let spent = 0;
	/** One fetch serves every read that waits on it; a failed one leaves none. */
	let view: Promise<View> | undefined;

	const refetch = (): Promise<View> => {
		spent++;

		const fetched = git.raw(["fetch", "--prune", "--no-tags", "--quiet", REMOTE, `+${baseBranch}:${BASE_REF}`, `+refs/heads/${claimPrefix}*:${CLAIMS_REF}/*`]).then((): View => ({ sources: new Map() }));

		view = fetched;
		fetched.catch(() => {
			if (view === fetched) view = undefined;
		});

		return fetched;
	};

	const current = (): Promise<View> => view ?? refetch();

	/** A push that did not land leaves the remote unknown, so the next read fetches. */
	const pushCounted = async (args: readonly string[]) => {
		spent++;

		const outcome = await push(git, [REMOTE, ...args]).catch((cause: unknown) => {
			view = undefined;

			throw cause;
		});

		if (outcome === "conflict") view = undefined;

		return outcome;
	};

	const standingFromLine = (line: string): [string, StandingClaim][] => {
		const [ref = "", sha = "", subject = ""] = line.split("\t");
		const item = ref.slice(`${CLAIMS_REF}/`.length);
		const claim = claimOfCommit(item, subject);

		return claim ? [[item, { claim, sha }]] : [];
	};

	const readClaims = async (): Promise<ReadonlyMap<string, StandingClaim>> =>
		new Map((await git.raw(["for-each-ref", "--format=%(refname)%09%(objectname)%09%(contents:subject)", CLAIMS_REF])).split("\n").filter(Boolean).flatMap(standingFromLine));

	const claimsNow = async (): Promise<ReadonlyMap<string, StandingClaim>> => {
		const seen = await current();

		return (seen.claims ??= readClaims());
	};

	const sourceIn = (seen: View, path: string): Promise<string | undefined> => {
		const source = seen.sources.get(path) ?? readOrAbsent(git, ["show", `${BASE_REF}:${path}`]);

		seen.sources.set(path, source);

		return source;
	};

	/** An item file the view lacks is looked for once more after a fetch: a view holds only what was there when it was fetched. */
	const itemSource = async (id: string): Promise<string | undefined> => (await sourceIn(await current(), pathOf(id))) ?? sourceIn(await refetch(), pathOf(id));

	/** The local copy of the base takes a commit this adapter pushed to it, so reads after the write see it without a fetch. */
	const mirrorBase = async (sha: string, { path, content }: FileChange): Promise<void> => {
		await git.raw(["update-ref", BASE_REF, sha]);
		(await current()).sources.set(path, Promise.resolve(content));
	};

	/** The local copy of a claim takes the claim this adapter pushed. */
	const mirrorClaim = async (claim: Claim, sha: string): Promise<void> => {
		await git.raw(["update-ref", `${CLAIMS_REF}/${claim.item}`, sha]);

		const seen = await current();

		if (seen.claims) seen.claims = seen.claims.then((claims) => new Map(claims).set(claim.item, { claim, sha }));
	};

	const itemFileNames = async (): Promise<string[]> => ((await readOrAbsent(git, ["ls-tree", "--name-only", `${BASE_REF}:${itemsDir}`])) ?? "").split("\n").filter(isItemFileName);

	/** One bad file raises one card and is skipped; the other items go on. */
	const parseOrReport = (id: string, source: string): ItemFile | undefined => {
		try {
			return parseItemFile(source);
		} catch (error) {
			report({
				code: "item-malformed",
				item: id,
				cause: `${pathOf(id)} does not parse: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
				fix: `Fix the front matter or thread markers in ${pathOf(id)}.`,
			});

			return undefined;
		}
	};

	const loadItem = async (id: string): Promise<ItemFile | undefined> => {
		const source = await itemSource(id);

		return source === undefined ? undefined : parseOrReport(id, source);
	};

	const isReady = (file: ItemFile | undefined, standing: StandingClaim | undefined): file is ItemFile => file?.state === READY_STATE && !isLive(standing?.claim, now());

	const readyRef = async (name: string, claims: ReadonlyMap<string, StandingClaim>): Promise<ItemRef[]> => {
		const id = name.slice(0, -ITEM_EXTENSION.length);

		if (!ItemId.safeParse(id).success) {
			report({ code: "item-malformed", item: id, cause: `${itemsDir}/${name} has a name that is no item id`, fix: `Rename ${itemsDir}/${name} to letters, digits, dot, dash or underscore.` });

			return [];
		}

		const file = await loadItem(id);

		return isReady(file, claims.get(id)) ? [{ id, title: file.title }] : [];
	};

	/** A commit on `parent` with the base branch's tree, and `change` applied through a scratch index when given. */
	const commitOn = async (parent: string, message: string, change?: FileChange): Promise<string> => {
		const scratch = mkdtempSync(join(tmpdir(), "hum-index-"));
		const indexed = gitIn(repo, { identity, timeoutMs, env: { GIT_INDEX_FILE: join(scratch, "index") } });

		try {
			if (change) {
				await indexed.raw(["read-tree", BASE_REF]);
				await indexed.raw(["update-index", "--add", "--cacheinfo", `100644,${(await indexed.raw(["hash-object", "-w", "--stdin"], change.content)).trim()},${change.path}`]);
			}

			const tree = change ? (await indexed.raw(["write-tree"])).trim() : `${BASE_REF}^{tree}`;

			return (await indexed.raw(["-c", "commit.gpgsign=false", "commit-tree", tree, "-p", parent, "-m", message])).trim();
		} finally {
			rmSync(scratch, { recursive: true, force: true });
		}
	};

	const reportRefusal = (error: PushRefused): never => {
		report({
			code: "push-refused",
			item: base,
			cause: `The remote refused the push to ${base}: ${error.message.slice(0, 300)}`,
			fix: `Let this account push to ${base}, or point hum at a branch it may write.`,
		});

		throw error;
	};

	const pushToBase = async (sha: string): Promise<Landed> => {
		const outcome = await pushCounted([`${sha}:${baseBranch}`]).catch((cause: unknown) => (cause instanceof PushRefused ? reportRefusal(cause) : Promise.reject(cause)));

		if (outcome === "conflict") throw new LostRace(`another writer moved ${base} first`);

		return "push";
	};

	/** An owner's commit lands the way the base asks: a pull request that merges itself where one is required, a push elsewhere. */
	const landOwned = async (sha: string, message: string, label: string): Promise<Landed> => {
		const landed = await landOwnerCommit({
			sha,
			base,
			label,
			title: message,
			body: `The owner answered on item ${label}.`,
			branchPrefix: ownerBranchPrefix,
			mergeMethod,
			pulls,
			push: pushCounted,
		}).catch((cause: unknown) => (cause instanceof PushRefused ? reportRefusal(cause) : Promise.reject(cause)));

		if (landed.via === "conflict") throw new LostRace(`another writer moved ${base} first`);

		return landed.via;
	};

	/** Changes one file on the remote base branch, reading it afresh after every lost race. */
	const write = async (message: string, change: () => Promise<FileChange | undefined>, ownedBy?: string): Promise<void> => {
		const attempt = async () => {
			await current();

			const next = await change();

			if (!next) return;

			const sha = await commitOn((await git.raw(["rev-parse", BASE_REF])).trim(), message, next);
			const landed = ownedBy === undefined ? await pushToBase(sha) : await landOwned(sha, message, ownedBy);

			if (landed === "push") await mirrorBase(sha, next);
			else view = undefined;
		};

		await pRetry(attempt, { retries: writeRaceRetries, minTimeout: WRITE_RACE_BACKOFF_MS, randomize: true, shouldRetry: ({ error }) => error instanceof LostRace }).catch((cause: unknown) => {
			throw cause instanceof LostRace ? new PermanentError(`gave up after ${writeRaceRetries + 1} lost races pushing to ${base}`) : cause;
		});
	};

	const appendTo = (id: string, entry: Omit<ThreadEntry, "text" | "at">, text: string): Promise<void> =>
		write(
			`hum: ${entry.kind} on ${id}`,
			async () => {
				const source = await itemSource(id);

				if (source === undefined) throw new PermanentError(`no item "${id}" under ${itemsDir}/`);

				return { path: pathOf(id), content: appendEntry(source, { ...entry, at: now() }, text) };
			},
			entry.kind === "answer" ? id : undefined,
		);

	const take = claimer<StandingClaim>(
		{
			standing: async (id) => (await claimsNow()).get(id),
			isReady: async (id) => (await loadItem(id))?.state === READY_STATE,
			write: async (claim, over) => {
				const parent = over?.sha ?? (await git.raw(["rev-parse", BASE_REF])).trim();
				const sha = await commitOn(parent, claimCommitMessage(claim));

				if ((await pushCounted([`${sha}:refs/heads/${claimPrefix}${claim.item}`])) === "conflict") return false;

				await mirrorClaim(claim, sha);

				return true;
			},
		},
		now,
	);

	const read = async (id: string): Promise<Item> => {
		const item = parseArgument(ItemId, id);
		const [source, claims] = await Promise.all([itemSource(item), claimsNow()]);

		if (source === undefined) throw new PermanentError(`no item "${item}" under ${itemsDir}/`);

		const file = parseOrReport(item, source);

		if (!file) throw new PermanentError(`item "${item}" is malformed; see its fault card`);

		return { id: item, title: file.title, body: file.body, ready: isReady(file, claims.get(item)), thread: file.thread, labels: file.kind === undefined ? [] : [file.kind] };
	};

	const adapter = {
		apiVersion: 1,
		/** Fetches and pushes so far. */
		spent: () => spent,
		workSource: {
			listReady: async () => {
				await refetch();

				const [claims, names] = await Promise.all([claimsNow(), itemFileNames()]);

				return (await new PQueue({ concurrency: itemReadsAtOnce }).addAll(names.map((name) => () => readyRef(name, claims)))).flat();
			},
			read,
			claim: (id, holder, ttlMs) => take("claim", parseArgument(ItemId, id), holder, ttlMs),
			renew: (id, holder, ttlMs) => take("renew", parseArgument(ItemId, id), holder, ttlMs),
			comment: (id, text) => appendTo(id, { kind: "comment" }, text),
			fileFollowUp: async (from, { title, body }) => {
				const id = parseArgument(ItemId, followUpId(parseArgument(ItemId, from), title));

				await write(`hum: file ${id}`, async () => ((await itemSource(id)) === undefined ? { path: pathOf(id), content: newItemFile(title, followUpBody(body, from)) } : undefined));

				return { id, title };
			},
		},
		questions: {
			ask: (id, question) => appendTo(id, { kind: "question" }, questionText(question)),
			decide: (id, text) => appendTo(id, { kind: "decision" }, text),
		},
		answers: {
			answer: (id, { text, option }) => appendTo(id, answerMarker(option), text),
			/** The token is the remote base branch's tip; reading one ref spends no rate limit. */
			watch: async (since?: string): Promise<Watch> => {
				const [token = NO_BASE_TOKEN] = (await git.raw(["ls-remote", REMOTE, baseBranch])).split(/\s/).filter(Boolean);

				return { token, changed: token !== since };
			},
		},
	} satisfies Adapter & { readonly spent: () => number };

	return adapter;
};
