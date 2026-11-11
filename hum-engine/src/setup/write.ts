import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";
import type { GitIdentityRead } from "../adapters/git.ts";
import { type Config, loadConfig, type RawConfig, readConfigDir } from "../config/load.ts";
import { hashJson } from "../config/hash.ts";
import { Json } from "../config/json.ts";
import { migrateConfig } from "../config/migrate.ts";
import type { Refusal, Result } from "../config/refusal.ts";
import { Kind, READABLE_SCHEMA_VERSIONS, SCHEMA_VERSION } from "../config/schema.ts";
import { ciWorkflows } from "../service/workflows.ts";
import { renderUnit, type UnitKind } from "../service/unit.ts";
import { atomicWrite } from "../state/fs.ts";
import { shippedRaw } from "./shipped.ts";
import { withTimeouts } from "./waits.ts";

const WORKFLOW_FOLDER = join(".github", "workflows");

const HumObject = z.record(z.string(), Json);

/** The answers come from a model's JSON, so no answer may name the identity every commit is credited to: it comes from the owner's git config or their own hum.json. */
const AnsweredSettings = HumObject.refine((hum) => !("commitIdentity" in hum), "commitIdentity is never an answer: setup reads it from git config");

/** What the owner decided: the `hum.json` keys they set, the hours of each wait, and the schema the writer targets. */
export const SetupAnswers = z.strictObject({
	hum: AnsweredSettings.default({}),
	waitHours: z.record(z.string(), z.number().positive()).default({}),
	/** The schema version the writing skill produces; a newer one than this engine reads is refused. */
	schemaVersion: z.int().optional(),
});

export type SetupAnswers = z.infer<typeof SetupAnswers>;

export type SetupEnv = {
	readonly hopeSkills: ReadonlySet<string>;
	/** Where a Mac or Linux service unit is written; default the user's home. */
	readonly home?: string;
	readonly platform?: NodeJS.Platform;
	/** The program and PATH a unit starts `hum serve` with. */
	readonly runtime?: { readonly bun: string; readonly path: string };
	/** The owner's name and email as git config holds them: the identity hum.json takes unless it names one already. */
	readonly gitIdentity: GitIdentityRead;
};

export type SetupResult = { readonly ok: true; readonly written: readonly string[]; readonly config: Config } | { readonly ok: false; readonly refusal: Refusal };

const UPDATE_ENGINE = "Update the engine: bun add --exact @moo.md/hum@latest.";

/** Refuses a schema the installed engine does not read, whether the existing file has it or the writer would produce it. */
const schemaRefusal = (existing: Json | undefined, target: number): Refusal | undefined => {
	if (!READABLE_SCHEMA_VERSIONS.includes(target)) {
		return {
			code: "unknown-schema-version",
			found: target,
			readable: READABLE_SCHEMA_VERSIONS,
			message: `Setup would write hum.json schemaVersion ${target}, and this engine reads ${READABLE_SCHEMA_VERSIONS.join(", ")}. ${UPDATE_ENGINE} Nothing was written.`,
		};
	}

	const migrated = existing === undefined ? undefined : migrateConfig(existing);

	return migrated && !migrated.ok ? { ...migrated.refusal, message: `${migrated.refusal.message} Nothing was written.` } : undefined;
};

const noGitIdentity = (missing: readonly string[]): Refusal => ({
	code: "no-git-identity",
	missing,
	message: `hum commits as you, and git config holds no ${missing.join(" or ")}. Set ${missing.length === 1 ? "it" : "each"}, then run setup again: ${missing.map((key) => `git config --global ${key} "<yours>"`).join("; ")}. Nothing was written.`,
});

/** The identity hum.json already holds, else the one git config holds, else the refusal that says what to set. */
const identityOf = (hum: Readonly<Record<string, Json>>, git: GitIdentityRead): Result<Json> => {
	if (hum.commitIdentity !== undefined) return { ok: true, value: hum.commitIdentity };

	return git.found ? { ok: true, value: asJson(git.identity) } : { ok: false, refusal: noGitIdentity(git.missing) };
};

const readExisting = (repo: string): RawConfig | undefined => (existsSync(join(repo, ".hum", "hum.json")) ? readConfigDir(join(repo, ".hum")) : undefined);

type FileToWrite = { readonly path: string; readonly text: string };

const unitPath = (kind: UnitKind, label: string, home: string): string =>
	kind === "launchd" ? join(home, "Library", "LaunchAgents", `${label}.plist`) : join(home, ".config", "systemd", "user", `${label}.service`);

const jsonText = (value: Json): string => `${JSON.stringify(value, null, "\t")}\n`;

/** The keys of `hum.json` the owner's file holds: the structure every config needs, and each setting that is not the shipped default. */
const STRUCTURE = ["schemaVersion", "levels", "paths", "roles", "events", "kinds", "integrations"] as const;

const STRUCTURAL = new Set<string>(STRUCTURE);

const ownerKeys = (hum: Readonly<Record<string, Json>>, shipped: Readonly<Record<string, Json>>): Record<string, Json> =>
	Object.fromEntries(Object.entries(hum).filter(([key, value]) => STRUCTURAL.has(key) || hashJson(value) !== hashJson(shipped[key] ?? null)));

const asJson = (value: Kind | Readonly<Record<string, Json>>): Json => Json.parse(JSON.parse(JSON.stringify(value)));

/**
 * Writes `.hum/` and the service files from the owner's answers, or writes nothing: the config must pass every check
 * with every wait timed out, and must be a schema the installed engine reads (and the one already in the repo).
 */
export const writeSetup = (repo: string, answers: SetupAnswers, env: SetupEnv): SetupResult => {
	const existing = readExisting(repo);
	const refused = schemaRefusal(existing?.hum, answers.schemaVersion ?? SCHEMA_VERSION);

	if (refused) return { ok: false, refusal: refused };

	const shipped = shippedRaw();
	const base = existing ?? shipped;
	const shippedHum = HumObject.parse(shipped.hum);
	const given = { ...HumObject.parse(base.hum), ...answers.hum };
	const identity = identityOf(given, env.gitIdentity);

	if (!identity.ok) return identity;

	const hum = { ...given, commitIdentity: identity.value };
	const kinds = Object.fromEntries(Object.entries(withTimeouts(parseKinds(base), answers.waitHours)).map(([name, kind]) => [name, asJson(kind)]));
	const roles = { ...shipped.roles, ...existing?.roles };
	const loaded = loadConfig({ hum: asJson(hum), kinds, roles }, { env: { hopeSkills: env.hopeSkills } });

	if (!loaded.ok) return { ok: false, refusal: loaded.refusal };

	const files = [
		{ path: join(repo, ".hum", "hum.json"), text: jsonText(ownerKeys(hum, shippedHum)) },
		...Object.entries(kinds).map(([name, kind]) => ({ path: join(repo, ".hum", "kinds", `${name}.json`), text: jsonText(kind) })),
		...Object.entries(roles).map(([file, text]) => ({ path: join(repo, ".hum", file), text })),
		...(existsSync(join(repo, ".hum", "memory.md")) ? [] : [{ path: join(repo, ".hum", "memory.md"), text: "" }]),
		...(existsSync(join(repo, loaded.value.hum.itemsDir, ".gitkeep")) ? [] : [{ path: join(repo, loaded.value.hum.itemsDir, ".gitkeep"), text: "" }]),
		...(loaded.value.hum.runPlaces.includes("ci") ? ciWorkflows(loaded.value.hum).map(({ file, text }) => ({ path: join(repo, WORKFLOW_FOLDER, file), text })) : []),
		...(loaded.value.hum.runPlaces.includes("mac") ? [serviceFile(repo, loaded.value, env)] : []),
	];

	for (const { path, text } of files) atomicWrite(path, text);

	return { ok: true, written: files.map(({ path }) => path), config: loaded.value };
};

const parseKinds = (raw: RawConfig): Record<string, Kind> => Object.fromEntries(Object.entries(raw.kinds).map(([name, file]) => [name, Kind.parse(file)]));

const serviceFile = (repo: string, config: Config, env: SetupEnv): FileToWrite => {
	const kind: UnitKind = (env.platform ?? process.platform) === "darwin" ? "launchd" : "systemd";
	const home = env.home ?? homedir();
	const bun = env.runtime?.bun ?? process.execPath;
	const label = config.hum.serviceLabel;

	return {
		path: unitPath(kind, label, home),
		text: renderUnit(kind, {
			label,
			repo,
			command: [bun, join(repo, "node_modules", ".bin", "hum"), "serve"],
			path: env.runtime?.path ?? [dirname(bun), dirname(Bun.which("git") ?? "/usr/bin/git"), dirname(Bun.which("claude") ?? "/usr/local/bin/claude"), "/usr/bin", "/bin"].join(":"),
			env: {},
			log: join(home, kind === "launchd" ? join("Library", "Logs") : join(".local", "state"), `${label}.log`),
			restartDelaySeconds: config.hum.restartDelaySeconds,
		}),
	};
};

/** The answers file the skill writes: `{ "hum": {...}, "waitHours": {...}, "schemaVersion": 1 }`. */
export const readAnswers = (file: string): SetupAnswers => SetupAnswers.parse(JSON.parse(readFileSync(file, "utf8")));
