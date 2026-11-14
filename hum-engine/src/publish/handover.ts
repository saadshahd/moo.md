import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import { type ClaimResult, Holder, Item, ItemId, type Questions, type WorkSource } from "../adapter-api.ts";
import { gitIn } from "../adapters/git.ts";
import type { ThinResult } from "../worker/thin-path.ts";
import type { BaseCheck } from "../worker/base-check.ts";
import { Intent } from "./intents.ts";

const text = z.string().min(1);

const sha = z.string().regex(/^[0-9a-f]{40}$/);

/** Where an inbox or outbox keeps the state folder, beside its JSON file. */
const STATE_FOLDER = "state";

const INBOX_FILE = "inbox.json";

const OUTBOX_FILE = "outbox.json";

/**
 * What gather settled for a wake, which publish trusts and reads from gather's own job outputs, never from an
 * artifact the work job could replace: who claimed, the base and hum branch heads it saw, the items it claimed, and
 * the state commit it saved.
 */
export const Gathered = z.strictObject({
	holder: Holder,
	base: text,
	baseSha: sha,
	/** Each hum branch gather saw, at its head. */
	heads: z.record(text, sha),
	claimed: z.array(ItemId),
	/** The state commit gather saved, which publish must find still there and replaces; absent when it saved none. */
	stateRead: sha.optional(),
});

export type Gathered = z.infer<typeof Gathered>;

/** What gather hands the work job, which holds no token: what it settled, and each item it claimed as it read it last. */
export const Inbox = z.strictObject({ gathered: Gathered, items: z.array(Item) });

export type Inbox = z.infer<typeof Inbox>;

/** A pass's result as the work job reports it; publish alone merges or lands, so it takes neither from the work job. */
const WorkResult = z.discriminatedUnion("outcome", [
	z.strictObject({ outcome: z.enum(["lost", "waiting"]), item: text }),
	z.strictObject({ outcome: z.literal("moved"), item: text, kind: text }),
	z.strictObject({ outcome: z.enum(["asked", "stuck", "review"]), item: text, detail: z.string().optional() }),
	z.strictObject({ outcome: z.literal("limited"), item: text, until: z.int().nonnegative() }),
	z.strictObject({ outcome: z.literal("held"), item: text, why: z.string() }),
]);

export type WorkResult = z.infer<typeof WorkResult>;

const BUNDLE_NAME = /^[\w.-]+\.bundle$/;

/** One pass the work job ran: its item, its result, what it asks publish to do and the bundle file it made. */
const OutboxPass = z.strictObject({ item: ItemId, result: WorkResult, intents: z.array(Intent), bundle: z.string().regex(BUNDLE_NAME).optional() });

/** The repo's checks the work job ran on gather's base for the merges no check had covered: their failure, absent when they passed. */
const BaseCheckReport = z.strictObject({ items: z.array(ItemId).min(1), failure: z.string().optional() });

export const OutboxFile = z.strictObject({ passes: z.array(OutboxPass), baseCheck: BaseCheckReport.optional() });

type OutboxFile = z.infer<typeof OutboxFile>;

const readOutboxFile = (folder: string): OutboxFile => {
	const file = join(folder, OUTBOX_FILE);

	return existsSync(file) ? OutboxFile.parse(JSON.parse(readFileSync(file, "utf8"))) : { passes: [] };
};

const writeOutboxFile = (folder: string, outbox: z.input<typeof OutboxFile>): void => {
	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, OUTBOX_FILE), `${JSON.stringify(OutboxFile.parse(outbox))}\n`);
};

export type OutboxPass = z.infer<typeof OutboxPass>;

/** Writes the inbox, with a copy of the state folder, into `folder`. */
export const writeInbox = (folder: string, inbox: Inbox, stateDir: string): void => {
	mkdirSync(folder, { recursive: true });
	writeFileSync(join(folder, INBOX_FILE), `${JSON.stringify(Inbox.parse(inbox))}\n`);
	cpSync(stateDir, join(folder, STATE_FOLDER), { recursive: true });
};

/** The inbox in `folder`, its state folder copied to `stateDir`. */
export const readInbox = (folder: string, stateDir: string): Inbox => {
	const inbox = Inbox.parse(JSON.parse(readFileSync(join(folder, INBOX_FILE), "utf8")));

	if (existsSync(join(folder, STATE_FOLDER))) cpSync(join(folder, STATE_FOLDER), stateDir, { recursive: true });

	return inbox;
};

const refused = (what: string): never => {
	throw new Error(`the work job's ${what}, so this wake publishes nothing`);
};

export type WorkIntegrations = { readonly workSource: WorkSource; readonly questions: Questions };

/** The integrations a work job runs on: the inbox's reads, its claims as gather took them, and no write at all. */
export const inboxIntegrations = (inbox: Inbox, now: () => number): WorkIntegrations => {
	const items = new Map(inbox.items.map((item) => [item.id, item]));

	const claimed = async (id: ItemId, _holder: Holder, ttlMs: number): Promise<ClaimResult> => ({ won: items.has(id), claim: { item: id, holder: inbox.gathered.holder, expiresAt: now() + ttlMs } });

	const writes = async (): Promise<never> => refused("integrations take no write: a pass writes through its outbox");

	return {
		workSource: {
			listReady: async () => inbox.items.map(({ id, title }) => ({ id, title })),
			read: async (id) => items.get(id) ?? refused(`inbox holds no item ${id}`),
			claim: claimed,
			renew: claimed,
			comment: writes,
			fileFollowUp: writes,
			finish: writes,
		},
		questions: { ask: writes, decide: writes },
	};
};

/** Adds a pass to the outbox in `folder`, its bundle moved beside it. */
export const writePass = (folder: string, { item, result, intents, bundle }: { readonly item: string; readonly result: ThinResult; readonly intents: readonly z.input<typeof Intent>[]; readonly bundle: string | undefined }): void => {
	const outbox = readOutboxFile(folder);
	const kept = bundle === undefined ? undefined : `${item}-${outbox.passes.length}.bundle`;

	mkdirSync(folder, { recursive: true });

	if (bundle !== undefined && kept !== undefined) cpSync(bundle, join(folder, kept));

	writeOutboxFile(folder, { ...outbox, passes: [...outbox.passes, { item, result: WorkResult.parse(result), intents: [...intents], bundle: kept }] });
};

/** Puts the base check the work job ran into the outbox in `folder`. */
export const writeBaseCheck = (folder: string, { items, failure }: BaseCheck): void => writeOutboxFile(folder, { ...readOutboxFile(folder), baseCheck: { items: [...items], failure } });

export type ReadOutbox = { readonly passes: readonly OutboxPass[]; readonly baseCheck: BaseCheck | undefined; readonly stateDir: string; readonly bundleOf: (pass: OutboxPass) => string | undefined };

/** Ends the work job's outbox: an empty one where nothing was written, and a copy of its state folder for publish to take its own records from. */
export const writeOutboxState = (folder: string, stateDir: string): void => {
	writeOutboxFile(folder, readOutboxFile(folder));

	if (existsSync(stateDir)) cpSync(stateDir, join(folder, STATE_FOLDER), { recursive: true });
};

/**
 * The outbox in `folder`, refused whole before any write when it is larger than `maxBytes`, fails its schema, names a
 * bundle outside the folder or an item gather did not claim. Its state folder is the work job's, which publish reads
 * only through `takeWorkRecords`.
 */
export const readOutbox = (folder: string, { maxBytes, claimed }: { readonly maxBytes: number; readonly claimed: ReadonlySet<string> }): ReadOutbox => {
	const size = sizeOf(folder);

	if (size > maxBytes) refused(`outbox holds ${size} bytes, over the ${maxBytes} bytes publish reads`);

	const { passes, baseCheck } = OutboxFile.parse(JSON.parse(readFileSync(join(folder, OUTBOX_FILE), "utf8")));
	const stranger = passes.find(({ item }) => !claimed.has(item));

	if (stranger !== undefined) refused(`outbox names ${stranger.item}, which gather did not claim`);

	return { passes, baseCheck, stateDir: join(folder, STATE_FOLDER), bundleOf: (pass) => pass.bundle && join(folder, basename(pass.bundle)) };
};

/** The bytes of every file under `folder`, links not followed. */
const sizeOf = (folder: string): number =>
	[...new Bun.Glob("**").scanSync({ cwd: folder, onlyFiles: true, dot: true, followSymlinks: false })].reduce((total, file) => total + lstatSync(join(folder, file)).size, 0);

/**
 * A bare repo of the checkout with the base and each hum branch at the commits gather saw: the remote a work job's runs
 * clone, so they start where publish checks them from. A commit the checkout lacks throws.
 */
export const workRemote = async ({ checkout, gathered, folder, timeoutMs }: { readonly checkout: string; readonly gathered: Gathered; readonly folder: string; readonly timeoutMs: number }): Promise<string> => {
	await gitIn(checkout, { timeoutMs }).raw(["clone", "--bare", "-q", checkout, folder]);

	const git = gitIn(folder, { timeoutMs });

	for (const [branch, at] of [[gathered.base, gathered.baseSha], ...Object.entries(gathered.heads)] as const) await git.raw(["update-ref", `refs/heads/${branch}`, at]);

	return folder;
};
