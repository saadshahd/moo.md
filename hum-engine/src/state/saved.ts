import { z } from "zod";
import { AlignmentAnswer } from "../decide/alignment.ts";
import { REQUEST_KINDS } from "../adapter-api.ts";
import { DISPOSITIONS, RESOLUTION_SOURCES } from "../decide/answer.ts";
import { REQUEST_DISPOSITIONS } from "../decide/request.ts";
import { Cite, PlanFile } from "../decide/prose.ts";
import { Change } from "../decide/risk.ts";
import { BuildChoice, WorkOrder } from "../decide/talk.ts";

const name = z.string().min(1);
const time = z.int().nonnegative();

/** Why an item sits out: it ended stuck, or its change waits for the owner's review. Until the owner acts, no run starts for it. */
export const Parked = z.object({ item: name, why: z.enum(["stuck", "review"]), cause: name, since: time });

export type Parked = z.infer<typeof Parked>;

/** Tokens an item has spent over all its runs. The cap counts those after `base`, the total when the owner last answered. */
export const Spent = z.object({ item: name, total: time, base: time });

export type Spent = z.infer<typeof Spent>;

/** Until when every run is held. Saved so a restart makes no call before it. */
export const Limit = z.object({ until: time });

/** The ids a provider last listed as ready, so a restart still sees an empty list that contradicts them. */
export const ReadyList = z.object({ ids: z.array(name) });

/** The alignment call's grades, or why it abstained. */
export const Alignment = z.union([z.object({ graded: AlignmentAnswer }), z.object({ abstained: name })]);

/** One file a change holds, with its lines added and removed; a binary file counts none. */
export const ChangedFile = z.object({ path: name, added: z.int().nonnegative().optional(), removed: z.int().nonnegative().optional() });

export type ChangedFile = z.infer<typeof ChangedFile>;

/** A finished change on its way to the base: what its diff showed, so a retry lands it again without a run. */
export const Landing = z.object({
	item: name,
	branch: name,
	since: time,
	change: Change,
	/** The commit the change ends at, before hum marks the item done: what a review reads. */
	head: name,
	/** The passes in a row whose push to the base another push beat. */
	lostRaces: z.int().nonnegative().default(0),
	/** The change's patch id against the base: the same change rebased keeps its landing. */
	patch: z.string().optional(),
	/** Made once per change. */
	alignment: Alignment.optional(),
	/** The run branch's commits past the base, oldest first, hum's done mark among them: what a push puts on the base. Absent on a landing saved before hum kept them. */
	commits: z.array(name).optional(),
	/** Each file the change holds against the base: what the owner's handoff lists. Absent on a landing saved before hum kept them. */
	files: z.array(ChangedFile).optional(),
	/** By the head each of the item's reviews judged, the files that changed from it to `head`; a head git could not read is left out. */
	changedSince: z.record(name, z.array(name)).optional(),
});

export type Landing = z.infer<typeof Landing>;

/** A path rule the owner's answer made, committed on the base; the view lists it with an undo. */
export const Learned = z.object({ glob: name, level: name, item: name, commit: name, pull: name.optional(), at: time });

export type Learned = z.infer<typeof Learned>;

/**
 * An engine version hum could not update to, by version: it failed, and hum tries it again only once the base moves
 * past `base`; or its pin waits in a pull request, which lands it once merged.
 */
export const EngineUpdate = z.discriminatedUnion("outcome", [
	z.object({ version: name, outcome: z.literal("failed"), cause: name, fix: name, base: name, at: time }),
	z.object({ version: name, outcome: z.literal("opened"), pull: name, at: time }),
]);

export type EngineUpdate = z.infer<typeof EngineUpdate>;

/** The model ids that answered a model-judgment call; the measured record decides later whether they count. */
const models = z.array(name);

/** An item's kind, decided once: named by its source, picked by the model call, or the fallback when the call abstained. */
export const ItemKind = z.discriminatedUnion("from", [
	z.object({ item: name, kind: name, from: z.literal("source") }),
	z.object({ item: name, kind: name, from: z.literal("model") }),
	z.object({ item: name, kind: name, from: z.literal("fallback"), why: name }),
]);

export type ItemKind = z.infer<typeof ItemKind>;

/** The plan a plan run made ready, saved with its hash so later runs read it unchanged. */
export const SavedPlan = z.object({ item: name, plan: PlanFile, hash: name, models });

export type SavedPlan = z.infer<typeof SavedPlan>;

/** What the owner settled in the item's ideate and shape rows: the work order they took, then each choice shape named, with their pick once a row settled it. */
export const SavedTalk = z.object({ item: name, order: WorkOrder.optional(), choices: z.array(BuildChoice).optional() });

export type SavedTalk = z.infer<typeof SavedTalk>;

/** One picture or video of the change at work, kept at `url`, or why the one the run named was left out. */
export const Evidence = z.union([z.object({ kind: z.enum(["image", "video"]), url: z.url() }), z.object({ left: name })]);

export type Evidence = z.infer<typeof Evidence>;

/** The pull request a build or fix run wrote for its item's whole change, under the repo's own rules for one; the latest run's stands. */
export const PullRequestText = z.object({ item: name, title: name, body: name, evidence: Evidence.optional() });

export type PullRequestText = z.infer<typeof PullRequestText>;

/** A review's verdict on the change that ends at `head`, with that change's patch id against its base, which a rebase keeps. */
export const Verdict = z.object({ item: name, head: name, patch: z.string().optional(), event: name, reason: z.string(), cites: z.array(Cite), models });

export type Verdict = z.infer<typeof Verdict>;

/**
 * A review run's answer on the change that ends at `head`, kept whether or not hum took it, so the owner's handoff
 * lists every review: `refused` says why hum set the answer aside and asked again. A review that ran as a Rail row
 * names it by `run`; one at landing names none.
 */
export const Review = z.object({
	item: name,
	head: name,
	at: time,
	run: z.object({ name, label: name }).optional(),
	event: name,
	reason: z.string(),
	cites: z.array(Cite),
	plan: PlanFile.optional(),
	refused: name.optional(),
});

export type Review = z.infer<typeof Review>;

/** A question the run asked, waiting for room under the daily cap until `askedAt` is set; `askedAt` stays to count the day. */
export const QueuedQuestion = z.object({
	item: name,
	text: name,
	options: z.array(name).optional(),
	detail: z.string().optional(),
	/** The index of the item's best priority label; no label is last. */
	priority: z.int().nonnegative(),
	/** The files the item declares it touches; none declared means it clashes with every item. */
	footprint: z.array(name).optional(),
	queuedAt: time,
	askedAt: time.optional(),
});

export type QueuedQuestion = z.infer<typeof QueuedQuestion>;

/** A follow-up item a pass filed, which counts against the daily question cap like a question asked. */
export const FiledFollowUp = z.object({ item: name, from: name, at: time });

/**
 * The check a fix item's repro run wrote: the command that fails because of the bug, what stood in for the reported
 * environment where it was not at hand, the commit that added it and the files it touched. `unopposed` is set once the
 * owner's window to object to it closed with no objection; `proven` counts the runs that passed once the fix was in.
 */
export const SavedRepro = z.object({ item: name, command: name, translated: name.optional(), commit: name, files: z.array(name), unopposed: z.literal(true).optional(), proven: z.int().positive().optional() });

export type SavedRepro = z.infer<typeof SavedRepro>;

/** A part a split filed, as publish filed it: the item it split from, the parts it waits on and the one command that proves it. Only publish writes these, so each check is hum's own. */
export const FiledPart = z.object({ item: name, from: name, waitsOn: z.array(name), check: name });

export type FiledPart = z.infer<typeof FiledPart>;

const settledFields = {
	item: name,
	/** The answer's number among the thread's answers and replies from people. */
	ordinal: z.int().positive(),
	text: name,
	disposition: z.enum(DISPOSITIONS),
	why: name,
	at: time,
};

/** What became of one answer on an item's thread, saved before its reply is posted: a marker may name an option, a first word or a model call always does, and the rest name none. */
export const SettledAnswer = z.discriminatedUnion("source", [
	z.object({ ...settledFields, source: z.literal(RESOLUTION_SOURCES.marker), option: name.optional() }),
	z.object({ ...settledFields, source: z.enum([RESOLUTION_SOURCES["first-word"], RESOLUTION_SOURCES.model]), option: name }),
	z.object({ ...settledFields, source: z.enum([RESOLUTION_SOURCES.free, RESOLUTION_SOURCES["none-of-these"], RESOLUTION_SOURCES.abstained]) }),
]);

export type SettledAnswer = z.infer<typeof SettledAnswer>;

/** What became of one owner's request on an item's thread, saved before its reply is posted. */
export const SettledRequest = z.object({
	item: name,
	/** The request's number among the thread's requests. */
	ordinal: z.int().positive(),
	kind: z.enum(REQUEST_KINDS),
	/** The step it named; a hand-written marker may name none. */
	step: name.optional(),
	disposition: z.enum(REQUEST_DISPOSITIONS),
	why: name,
	at: time,
});

export type SettledRequest = z.infer<typeof SettledRequest>;

/** The option a settled answer picked, when its source names one. */
export const optionOf = (answer: SettledAnswer): string | undefined => ("option" in answer ? answer.option : undefined);

/** Whether a settled answer changed the plan: one applied, and not one picking an option of `steering`, hum's own. */
export const changesPlan = (answer: SettledAnswer, steering: ReadonlySet<string>): boolean => {
	const option = optionOf(answer);

	return answer.disposition === "applied" && (option === undefined || !steering.has(option));
};

const slotFields = {
	name,
	/** Which block of ports, among the slots, is this slot's. */
	index: z.int().nonnegative(),
	folder: name,
	/** The hash of the lockfiles the slot's dependencies were last installed from. */
	lockfiles: name.optional(),
	since: time,
};

/**
 * A prewarmed worktree of the owner's checkout that background runs work in. A free slot is made and not yet ready,
 * ready, returned and waiting to be refreshed, or out of the pool. A held slot is taken by an item's pass, or kept
 * because its branch holds a commit the remote lacks; it names the item.
 */
export const Slot = z.discriminatedUnion("status", [
	z.object({ ...slotFields, status: z.enum(["new", "free", "stale", "out"]) }),
	z.object({ ...slotFields, status: z.enum(["taken", "kept"]), item: name }),
]);

export type Slot = z.infer<typeof Slot>;

export type HeldSlot = Extract<Slot, { readonly item: string }>;

export type FreeSlot = Exclude<Slot, HeldSlot>;
