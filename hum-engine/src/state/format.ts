import { z } from "zod";
import pkg from "../../package.json" with { type: "json" };
import { Json } from "../config/json.ts";

/** The engine that is running; every snapshot records it (V10). */
export const ENGINE_VERSION: string = pkg.version;

/** The envelope shape version this engine writes. A change here is public surface. */
export const ENVELOPE_FORMAT = 1;

/** What every format of the envelope carries, enough to refuse a file from a newer engine before reading the rest. */
export const Header = z.looseObject({ format: z.int().nonnegative(), engineVersion: z.string().min(1) });

/** One saved item: the machine's persisted snapshot and what is needed to restore it later. */
export const Envelope = z.strictObject({
	format: z.literal(ENVELOPE_FORMAT),
	engineVersion: z.string().min(1),
	itemId: z.string().min(1),
	kind: z.string().min(1),
	/** The kind machine's version when the snapshot was taken; `migrateSnapshot` moves it across a change. */
	machineVersion: z.string().min(1),
	savedAt: z.int().nonnegative(),
	snapshot: Json,
});

export type Envelope = z.infer<typeof Envelope>;

export const EnvelopeJson = z.record(z.string(), Json);

export type EnvelopeJson = z.infer<typeof EnvelopeJson>;

/** Per earlier envelope format: rewrites an envelope at that format into the next format's shape (V10). */
export type EnvelopeMigrations = Readonly<Record<number, (envelope: EnvelopeJson) => EnvelopeJson>>;

/** One entry per earlier format, from format 0 up. Empty while format 1 is the first shipped. */
export const ENVELOPE_MIGRATIONS: EnvelopeMigrations = {};

const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/;

/** Orders two engine versions; undefined when either is not `major.minor.patch[-pre]`. */
export const compareVersions = (a: string, b: string): -1 | 0 | 1 | undefined => {
	const left = VERSION.exec(a);
	const right = VERSION.exec(b);

	if (!left || !right) return undefined;

	for (const at of [1, 2, 3]) {
		const difference = Number(left[at]) - Number(right[at]);

		if (difference !== 0) return difference < 0 ? -1 : 1;
	}

	// A release is newer than any pre-release of the same triple.
	if (left[4] === right[4]) return 0;

	if (left[4] === undefined) return 1;

	if (right[4] === undefined) return -1;

	return left[4] < right[4] ? -1 : 1;
};

/** The part of an envelope that names the item and its machine, enough to list what is saved without restoring it. */
export const SavedHeader = z.looseObject({
	itemId: z.string().min(1),
	kind: z.string().min(1),
	machineVersion: z.string().min(1),
	savedAt: z.int().nonnegative(),
	snapshot: z.looseObject({ value: z.string().optional().catch(undefined) }),
});
