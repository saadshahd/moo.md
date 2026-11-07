import { randomUUID, createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import {
	type Adapter,
	type AdapterContext,
	type Answer,
	type Claim,
	type ClaimResult,
	type FollowUp,
	Item,
	ItemId,
	type ItemRef,
	PermanentError,
	type Question,
	type ThreadEntry,
	type Watch,
} from "../adapter-api.ts";
import { appendEntry, parseThread } from "./thread.ts";
import { type Git, HOOKS_OFF, pushHooksOff, PushRefused, runGit } from "./git.ts";

export type MarkdownOptions = {
	/** A clone of the work repo. The adapter never touches its working tree or its branches. */
	readonly repo: string;
	readonly remote?: string;
	/** The branch whose `.hum/work/` holds the items; answers are pushed to it. */
	readonly base?: string;
	readonly dir?: string;
	readonly git?: Git;
};

const BASE_REF = "refs/hum/base";
const CLAIMS_REF = "refs/hum/claims";

/** A claim is the first push of this branch; C1 sees it as a hum branch. */
const CLAIM_BRANCH = "hum/claim";
const IDENTITY = { GIT_AUTHOR_NAME: "hum", GIT_AUTHOR_EMAIL: "hum@moo.md", GIT_COMMITTER_NAME: "hum", GIT_COMMITTER_EMAIL: "hum@moo.md" };
const WRITE_ATTEMPTS = 8;

const FrontMatter = z.looseObject({ title: z.string().min(1), state: z.string().min(1) });

const HOLDER = /^[A-Za-z0-9][\w.@:-]{0,99}$/;

type Parsed = { readonly title: string; readonly state: string; readonly body: string; readonly thread: ThreadEntry[] };

/** An item file: front matter, a body, then thread entries each opened by a `<!-- hum {…} -->` line. */
export const parseItemFile = (source: string): Parsed => {
	const lines = source.split("\n");

	if (lines[0] !== "---") throw new Error("front matter missing: the file must open with a '---' line");

	const close = lines.indexOf("---", 1);

	if (close < 0) throw new Error("front matter never closes with a '---' line");

	const front = FrontMatter.parse(Bun.YAML.parse(lines.slice(1, close).join("\n")));

	return { title: front.title, state: front.state, ...parseThread(lines.slice(close + 1)) };
};

const kebab = (title: string): string =>
	title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40);

type ClaimRef = { readonly sha: string; readonly claim: Claim };

/**
 * The default work source. Items are markdown files under `.hum/work/` on the base branch of a git remote.
 * Every write is a commit built from git plumbing, so the clone's working tree and branches stay untouched,
 * pushed with hooks off. A claim is the first push of `hum/claim/<id>`; a renewal is a fast-forward on top.
 */
export const markdownAdapter = (
	{ repo, remote = "origin", base = "main", dir = ".hum/work", git = runGit }: MarkdownOptions,
	{ report, now }: AdapterContext,
) => {
	let spent = 0;
	const cwd = repo;
	const baseBranch = `refs/heads/${base}`;

	const run = async (args: readonly string[], options: { env?: Record<string, string>; input?: string } = {}) => {
		const result = await git([...HOOKS_OFF, ...args], { cwd, ...options });

		if (result.code !== 0) throw new Error(`git ${args.join(" ")} failed (${result.code}): ${result.stderr.trim()}`);

		return result.stdout;
	};

	const sync = async () => {
		spent++;
		await run(["fetch", "--prune", "--no-tags", "--quiet", remote, `+${baseBranch}:${BASE_REF}`, `+refs/heads/${CLAIM_BRANCH}/*:${CLAIMS_REF}/*`]);
	};

	const claimsNow = async (): Promise<Map<string, ClaimRef>> => {
		const out = await run(["for-each-ref", "--format=%(refname)%09%(objectname)%09%(contents:subject)", CLAIMS_REF]);
		const found = new Map<string, ClaimRef>();

		for (const line of out.split("\n").filter(Boolean)) {
			const [ref = "", sha = "", subject = ""] = line.split("\t");
			const item = ref.slice(`${CLAIMS_REF}/`.length);
			const match = /^hum-claim (\S+) (\d+)$/.exec(subject);

			if (match) found.set(item, { sha, claim: { item, holder: match[1] ?? "", expiresAt: Number(match[2]) } });
		}

		return found;
	};

	const fileNames = async (): Promise<string[]> => {
		const listed = await git([...HOOKS_OFF, "ls-tree", "--name-only", `${BASE_REF}:${dir}`], { cwd });

		return listed.code === 0 ? listed.stdout.split("\n").filter((name) => name.endsWith(".md")) : [];
	};

	const readFile = async (id: string): Promise<string | undefined> => {
		const shown = await git([...HOOKS_OFF, "show", `${BASE_REF}:${dir}/${id}.md`], { cwd });

		return shown.code === 0 ? shown.stdout : undefined;
	};

	/** R1: one bad file raises one card and is skipped. The other items go on. */
	const load = async (id: string, source: string): Promise<{ parsed: Parsed; ref: ItemRef } | undefined> => {
		try {
			const parsed = parseItemFile(source);

			return { parsed, ref: { id: ItemId.parse(id), title: parsed.title } };
		} catch (error) {
			report({
				code: "item-malformed",
				item: id,
				cause: `${dir}/${id}.md does not parse: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`,
				fix: `Fix the front matter or thread markers in ${dir}/${id}.md.`,
			});

			return undefined;
		}
	};

	const live = (claim: ClaimRef | undefined): boolean => claim !== undefined && claim.claim.expiresAt > now();

	/** A commit on `parent` holding the base branch's tree, with `changes` applied through a throwaway index. */
	const commitOn = async (parent: string, message: string, changes: ReadonlyMap<string, string>): Promise<string> => {
		const scratch = mkdtempSync(join(tmpdir(), "hum-index-"));
		const env = { ...IDENTITY, GIT_INDEX_FILE: join(scratch, "index") };

		try {
			await run(["read-tree", BASE_REF], { env });

			for (const [path, content] of changes) {
				const blob = (await run(["hash-object", "-w", "--stdin"], { input: content, env })).trim();

				await run(["update-index", "--add", "--cacheinfo", `100644,${blob},${path}`], { env });
			}

			const tree = (await run(["write-tree"], { env })).trim();

			return (await run(["-c", "commit.gpgsign=false", "commit-tree", tree, "-p", parent, "-m", message], { env })).trim();
		} finally {
			rmSync(scratch, { recursive: true, force: true });
		}
	};

	/** Q1: edit files on the remote base branch and push the commit with hooks off, retrying a lost race. */
	const write = async (message: string, edit: (read: (id: string) => Promise<string | undefined>) => Promise<ReadonlyMap<string, string> | "unchanged">) => {
		for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
			await sync();

			const changes = await edit(readFile);

			if (changes === "unchanged") return;

			const parent = (await run(["rev-parse", BASE_REF])).trim();
			const sha = await commitOn(parent, message, changes);

			try {
				spent++;

				if ((await pushHooksOff(git, cwd, [remote, `${sha}:${baseBranch}`])) === "pushed") return;
			} catch (error) {
				if (error instanceof PushRefused) {
					report({
						code: "push-refused",
						item: base,
						cause: `The remote refused the push to ${base}: ${error.message.slice(0, 300)}`,
						fix: `Let this account push to ${base}, or point hum at a branch it may write.`,
					});
				}

				throw error;
			}
		}

		throw new PermanentError(`gave up after ${WRITE_ATTEMPTS} lost races pushing to ${base}`);
	};

	const entryWrite = (id: string, entry: Omit<ThreadEntry, "text" | "at">, text: string, message: string) =>
		write(message, async (read) => {
			const source = await read(id);

			if (source === undefined) throw new PermanentError(`no item "${id}" under ${dir}/`);

			return new Map([[`${dir}/${id}.md`, appendEntry(source, { ...entry, at: now() }, text)]]);
		});

	const item = async (id: string): Promise<Item> => {
		ItemId.parse(id);
		await sync();

		const source = await readFile(id);

		if (source === undefined) throw new PermanentError(`no item "${id}" under ${dir}/`);

		const loaded = await load(id, source);

		if (!loaded) throw new PermanentError(`item "${id}" is malformed; see its fault card`);

		const claim = (await claimsNow()).get(id);

		return { ...loaded.ref, body: loaded.parsed.body, ready: loaded.parsed.state === "ready" && !live(claim), thread: loaded.parsed.thread };
	};

	const take = async (id: string, holder: string, ttlMs: number, renew: boolean): Promise<ClaimResult> => {
		ItemId.parse(id);

		if (!Number.isInteger(ttlMs) || ttlMs <= 0) throw new PermanentError(`a claim lasts a positive whole number of milliseconds, not ${ttlMs}`);

		if (!HOLDER.test(holder)) throw new PermanentError(`holder "${holder}" is not a plain name`);

		await sync();

		const current = (await claimsNow()).get(id);

		if (live(current) && current?.claim.holder !== holder) return { won: false, claim: current!.claim };

		if (renew && current?.claim.holder !== holder) {
			if (current) return { won: false, claim: current.claim };

			throw new PermanentError(`"${holder}" holds no claim on "${id}"`);
		}

		if (!current) {
			const source = await readFile(id);
			const loaded = source === undefined ? undefined : await load(id, source);

			if (!loaded || loaded.parsed.state !== "ready") throw new PermanentError(`item "${id}" is missing, malformed or not ready`);
		}

		const expiresAt = now() + ttlMs;
		const parent = current?.sha ?? (await run(["rev-parse", BASE_REF])).trim();
		const sha = await commitOn(parent, `hum-claim ${holder} ${expiresAt}\n\nnonce: ${randomUUID()}`, new Map());

		spent++;

		if ((await pushHooksOff(git, cwd, [remote, `${sha}:refs/heads/${CLAIM_BRANCH}/${id}`])) === "pushed") {
			return { won: true, claim: { item: id, holder, expiresAt } };
		}

		await sync();

		const winner = (await claimsNow()).get(id);

		if (!winner) throw new PermanentError(`claim on "${id}" lost a race to a claim that has since vanished`);

		return { won: false, claim: winner.claim };
	};

	const adapter: Adapter & { readonly spent: () => number } = {
		apiVersion: 1,
		spent: () => spent,
		workSource: {
			async listReady() {
				await sync();

				const claims = await claimsNow();
				const ready: ItemRef[] = [];

				for (const name of await fileNames()) {
					const id = name.slice(0, -".md".length);
					const idOk = ItemId.safeParse(id);

					if (!idOk.success) {
						report({ code: "item-malformed", item: id, cause: `${dir}/${name} has a name that is no item id`, fix: `Rename ${dir}/${name} to letters, digits, dot, dash or underscore.` });
						continue;
					}

					const source = await readFile(id);
					const loaded = source === undefined ? undefined : await load(id, source);

					if (loaded && loaded.parsed.state === "ready" && !live(claims.get(id))) ready.push(loaded.ref);
				}

				return ready;
			},
			read: item,
			claim: (id, holder, ttlMs) => take(id, holder, ttlMs, false),
			renew: (id, holder, ttlMs) => take(id, holder, ttlMs, true),
			comment: (id, text) => entryWrite(id, { kind: "comment" }, text, `hum: comment on ${id}`),
			async fileFollowUp(from: string, { title, body }: FollowUp) {
				ItemId.parse(from);

				const id = `${from}-${kebab(title) || "follow-up"}-${createHash("sha256").update(title).digest("hex").slice(0, 6)}`.slice(0, 100);
				const path = `${dir}/${id}.md`;

				await write(`hum: file ${id}`, async (read) => {
					if ((await read(id)) !== undefined) return "unchanged";

					return new Map([[path, `---\ntitle: ${JSON.stringify(title)}\nstate: ready\n---\n\n${body.trim()}\n\nFiled from ${from}.\n`]]);
				});

				return { id: ItemId.parse(id), title };
			},
		},
		questions: {
			ask: (id, { text, options }: Question) =>
				entryWrite(id, { kind: "question" }, options?.length ? `${text}\n\nOptions: ${options.join(", ")}` : text, `hum: question on ${id}`),
			decide: (id, text) => entryWrite(id, { kind: "decision" }, text, `hum: decision on ${id}`),
		},
		answers: {
			answer: (id, { text, option }: Answer) =>
				entryWrite(id, option === undefined ? { kind: "answer" } : { kind: "answer", option }, text, `hum: answer on ${id}`),
			/** Q1: the token is the remote base branch's tip. `ls-remote` is a read of one ref and counts toward no rate limit. */
			async watch(since?: string): Promise<Watch> {
				const out = await run(["ls-remote", remote, baseBranch]);
				const token = out.split(/\s/)[0] || "none";

				return { token, changed: token !== since };
			},
		},
	};

	return adapter;
};
