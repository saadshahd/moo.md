import { z } from "zod";

const name = z.string().min(1);
const time = z.int().nonnegative();

/** Where a review note comes from. */
const NOTE_SOURCES = ["review-comment", "review-body", "plan-answer", "revert", "fix"] as const;

export type NoteSource = (typeof NOTE_SOURCES)[number];

/** One correction the owner made to hum's work, saved before anything acts on it and keyed by its source and source id. */
export const ReviewNote = z.object({
	source: z.enum(NOTE_SOURCES),
	sourceId: name,
	/** What the note is about: the commit a comment sits on, the change a revert or fix names, or the item a plan answer corrected. */
	change: name,
	/** The item the note is known to belong to; a commit is matched to its item when the measure counts. */
	item: name.optional(),
	file: name.optional(),
	line: z.int().positive().optional(),
	/** The diff hunk the note points at; empty when the source has none. */
	hunk: z.string(),
	text: name,
	at: time,
});

export type ReviewNote = z.infer<typeof ReviewNote>;

/** A note's key in the saved records. */
export const noteKey = ({ source, sourceId }: Pick<ReviewNote, "source" | "sourceId">): string => `${source}:${sourceId}`;

/** Notes that state one rule. The key is its first note's, so a later note joins instead of starting another group. */
export const RepeatGroup = z.object({
	key: name,
	notes: z.array(name),
	/** The check item filed for the group. */
	item: name.optional(),
	/** Notes already added to the item's thread. */
	commented: z.array(name),
	/** The check landed and CI ran it. */
	checked: z.object({ at: time, check: name }).optional(),
	/** Notes that came after the check ran in CI. */
	misses: z.array(name),
});

export type RepeatGroup = z.infer<typeof RepeatGroup>;

/** Two notes only a model found alike, waiting for its precision to reach the owner's bar. */
export const PossibleRepeat = z.object({ a: name, b: name, models: z.array(name), at: time });

export type PossibleRepeat = z.infer<typeof PossibleRepeat>;

/** A merged change: what the measure counts. */
export const Merge = z.object({ item: name, sha: name, at: time, paths: z.array(name) });

export type Merge = z.infer<typeof Merge>;

/** A test of the base that failed after an item's change merged. */
export const Break = z.object({ item: name, sha: name, at: time, paths: z.array(name), level: name, failure: z.string(), onBreak: z.enum(["follow-up", "block"]), followUp: name });

export type Break = z.infer<typeof Break>;

const proofFields = {
	item: name,
	at: time,
	/** Worktrees made: one per note commit and one for the check's own head. */
	worktrees: z.int().nonnegative(),
	ms: z.int().nonnegative(),
};

/** What proving a check cost: the commits it ran on, and the time it took; a failed proof says why. */
export const Proof = z.discriminatedUnion("passed", [z.object({ ...proofFields, passed: z.literal(true) }), z.object({ ...proofFields, passed: z.literal(false), reason: z.string() })]);

export type Proof = z.infer<typeof Proof>;
