import { z } from "zod";
import { Json } from "./json.ts";
import { READABLE_SCHEMA_VERSIONS, SCHEMA_VERSION } from "./schema.ts";
import type { Result } from "./refusal.ts";

type ConfigJson = Readonly<Record<string, Json>>;

/** Per earlier version: rewrites a value at that version into the next version's shape. */
export type Steps<T> = Readonly<Record<number, (value: T) => T>>;

/** Applies each step from version `from` up to `to`, stamping the version under `versionKey`. A missing step is an engine bug and throws. */
export const climb = <T extends object>(value: T, from: number, to: number, steps: Steps<T>, versionKey: string): T =>
	Array.from({ length: Math.max(to - from, 0) }, (_, offset) => from + offset).reduce((current, at) => {
		const step = steps[at];

		if (!step) throw new Error(`no migration from ${versionKey} ${at}; the engine ships a gap`);

		return { ...step(current), [versionKey]: at + 1 };
	}, value);

/** Per earlier schema version: rewrites a config at that version into the next version's shape. */
export type Migrations = Steps<ConfigJson>;

/** One entry per earlier schema version. Setup climbs the owner's answers, a part of a config, through the same steps, so a step rewrites only the keys it finds. */
export const MIGRATIONS = {
	/** 2 holds the pull request token as one of its sources: the secret 1 named becomes `{ from: "secret", secret }`. */
	1: ({ pullRequestTokenSecret, ...config }) => (pullRequestTokenSecret === undefined ? config : { ...config, pullRequestToken: { from: "secret", secret: pullRequestTokenSecret } }),
} satisfies Migrations;

const Raw = z.record(z.string(), Json);
const Version = z.int();

/** Reads `schemaVersion` and migrates the config up to `current`, or refuses a version it does not read. */
export const migrateConfig = (
	raw: Json,
	{
		current = SCHEMA_VERSION,
		readable = READABLE_SCHEMA_VERSIONS,
		migrations = MIGRATIONS,
	}: { current?: number; readable?: readonly number[]; migrations?: Migrations } = {},
): Result<ConfigJson> => {
	const parsed = Raw.safeParse(raw);
	const version = parsed.success ? Version.safeParse(parsed.data.schemaVersion) : undefined;
	const found = version?.success ? version.data : undefined;

	if (!parsed.success || found === undefined || !readable.includes(found)) {
		const step =
			found !== undefined && found > current
				? "Update the engine: bun add --exact @moo.md/hum@latest."
				: "Run /hum to rewrite it.";

		return {
			ok: false,
			refusal: {
				code: "unknown-schema-version",
				found,
				readable,
				message: `hum.json schemaVersion ${found ?? "missing"} is not one this engine reads (reads ${readable.join(", ")}). ${step}`,
			},
		};
	}

	return { ok: true, value: climb(parsed.data, found, current, migrations, "schemaVersion") };
};
