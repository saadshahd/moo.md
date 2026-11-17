import semver from "semver";
import { z } from "zod";
import pkg from "../../package.json" with { type: "json" };
import { Json } from "../config/json.ts";
import type { Steps } from "../config/migrate.ts";

/** The engine that is running; every snapshot records it. */
export const ENGINE_VERSION: string = pkg.version;

/** The envelope shape version this engine writes. A change here is public surface. */
export const ENVELOPE_FORMAT = 1;

/** What every format of the envelope carries, enough to refuse a file from a newer engine before reading the rest. */
export const Header = z.looseObject({ format: z.int().nonnegative(), engineVersion: z.string().min(1) });

/** One saved item: the machine's persisted snapshot and what is needed to restore it later. */
export const Envelope = z.object({
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

/** Per earlier envelope format: rewrites an envelope at that format into the next format's shape. */
export type EnvelopeMigrations = Steps<EnvelopeJson>;

/** One entry per earlier format, from format 0 up. Empty while format 1 is the first shipped. */
export const ENVELOPE_MIGRATIONS: EnvelopeMigrations = {};

/** What the owner does about a file a newer engine wrote. */
export const UPDATE_ENGINE = "Update the engine to that version or later: bun add --exact @moo.md/hum@latest.";

/** A file's format and the engine that wrote it; a file from before engines were recorded names none. */
type Written = { readonly format: number; readonly engineVersion?: string | undefined };

/** True when a file's format is newer than the running engine reads, or a newer engine, or one whose version is unreadable, wrote it. */
export const isNewerThan = ({ format, engineVersion }: Written, running: { readonly format: number; readonly engineVersion: string }): boolean =>
	format > running.format || (engineVersion !== undefined && (semver.valid(engineVersion) === null || semver.gt(engineVersion, running.engineVersion)));

/** The part of an envelope that names the item and its machine, enough to list what is saved without restoring it. */
export const SavedHeader = z.looseObject({
	itemId: z.string().min(1),
	kind: z.string().min(1),
	machineVersion: z.string().min(1),
	savedAt: z.int().nonnegative(),
	snapshot: z.looseObject({ value: z.string().optional().catch(undefined) }),
});
