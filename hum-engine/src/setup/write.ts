import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";
import type { GitIdentityRead } from "../adapters/git.ts";
import { type Config, loadConfig, type RawConfig, readConfigDir } from "../config/load.ts";
import { hashJson } from "../config/hash.ts";
import { Json } from "../config/json.ts";
import { migrateConfig } from "../config/migrate.ts";
import { noGitIdentity, type Refusal, type Result } from "../config/refusal.ts";
import { type HumConfig, Kind, READABLE_SCHEMA_VERSIONS, SCHEMA_VERSION } from "../config/schema.ts";
import { isGitHubHosted } from "../config/wake-job.ts";
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
	/** Set only after the owner said yes: CI wakes may run on a runner GitHub does not host although anyone may comment on the repo. */
	ownRunnerOnPublicRepo: z.literal(true).optional(),
});

export type SetupAnswers = z.infer<typeof SetupAnswers>;

export type SetupEnv = {
	readonly installedSkills: ReadonlySet<string>;
	/** Where a Mac or Linux service unit is written; default the user's home. */
	readonly home?: string;
	readonly platform?: NodeJS.Platform;
	/** The program and PATH a unit starts `hum serve` with. */
	readonly runtime?: { readonly bun: string; readonly path: string };
	/** The owner's name and email as git config holds them: the identity hum.json takes unless it names one already. */
	readonly gitIdentity: GitIdentityRead;
	/** Whether anyone may read and comment on the repo, as GitHub says; left out where nothing could say. */
	readonly isPublicRepo?: boolean;
};

export type SetupResult = { readonly ok: true; readonly written: readonly string[]; readonly config: Config } | { readonly ok: false; readonly refusal: Refusal };

const UPDATE_ENGINE = "Update the engine: bun add --exact @moo.md/hum@latest.";

/** Refuses answers written for a schema the installed engine does not read. */
const targetRefusal = (target: number): Refusal | undefined =>
	READABLE_SCHEMA_VERSIONS.includes(target)
		? undefined
		: {
				code: "unknown-schema-version",
				found: target,
				readable: READABLE_SCHEMA_VERSIONS,
				message: `Setup would write hum.json schemaVersion ${target}, and this engine reads ${READABLE_SCHEMA_VERSIONS.join(", ")}. ${UPDATE_ENGINE} Nothing was written.`,
			};

/**
 * A wake runs an agent that holds the owner's secrets. On a runner GitHub does not host, what a wake leaves behind
 * stays on the machine, and on a public repo more people reach what starts a wake. So the owner says yes to the two
 * together, and a repo whose visibility nothing could read counts as public.
 */
const ownRunnerRefusal = ({ runPlaces, ciRunner }: HumConfig, answers: SetupAnswers, isPublicRepo: boolean | undefined): Refusal | undefined =>
	!runPlaces.includes("ci") || isGitHubHosted(ciRunner) || isPublicRepo === false || answers.ownRunnerOnPublicRepo === true
		? undefined
		: {
				code: "own-runner-on-public-repo",
				message: `ciRunner names a runner GitHub does not host, and this repo ${isPublicRepo ? "is public" : "may be public: gh could not say"}. A wake there runs an agent with your secrets on a machine that keeps what the wake leaves. Name a runner GitHub hosts, or ask the owner and set "ownRunnerOnPublicRepo": true in the answers. Nothing was written.`,
			};

/** Settings migrated to the schema this engine writes, so the repo's file and the answers merge at one version; refused at a schema it does not read. */
const atCurrentSchema = (hum: Json): Result<Readonly<Record<string, Json>>> => {
	const migrated = migrateConfig(hum);

	return migrated.ok ? migrated : { ok: false, refusal: { ...migrated.refusal, message: `${migrated.refusal.message} Nothing was written.` } };
};

/** The identity hum.json already holds, else the one git config holds, else the refusal that says what to set. */
const identityOf = (hum: Readonly<Record<string, Json>>, git: GitIdentityRead): Result<Json> => {
	if (hum.commitIdentity !== undefined) return { ok: true, value: hum.commitIdentity };

	if (git.found) return { ok: true, value: asJson(git.identity) };

	const refusal = noGitIdentity(git.missing);

	return { ok: false, refusal: { ...refusal, message: `${refusal.message} Nothing was written.` } };
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
	const target = answers.schemaVersion ?? SCHEMA_VERSION;
	const refused = targetRefusal(target);

	if (refused) return { ok: false, refusal: refused };

	const shipped = shippedRaw();
	const base = existing ?? shipped;
	const fromRepo = atCurrentSchema(base.hum);

	if (!fromRepo.ok) return fromRepo;

	const answered = atCurrentSchema({ ...answers.hum, schemaVersion: target });

	if (!answered.ok) return answered;

	const shippedHum = HumObject.parse(shipped.hum);
	const given = { ...fromRepo.value, ...answered.value };
	const identity = identityOf(given, env.gitIdentity);

	if (!identity.ok) return identity;

	const hum = { ...given, commitIdentity: identity.value };
	const timed = withTimeouts(parsedKinds(base), answers.waitHours);
	const kinds = Object.fromEntries(Object.entries(base.kinds).map(([name, file]) => [name, timed[name] ? asJson(timed[name]) : file]));
	const roles = { ...shipped.roles, ...existing?.roles };
	const loaded = loadConfig({ hum: asJson(hum), kinds, roles }, { env: { installedSkills: env.installedSkills } });

	if (!loaded.ok) return { ok: false, refusal: loaded.refusal };

	const ownRunner = ownRunnerRefusal(loaded.value.hum, answers, env.isPublicRepo);

	if (ownRunner) return { ok: false, refusal: ownRunner };

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

/** The kind files that parse. One that does not stays as it is, so the config check refuses it by name. */
const parsedKinds = (raw: RawConfig): Record<string, Kind> =>
	Object.fromEntries(
		Object.entries(raw.kinds).flatMap(([name, file]) => {
			const kind = Kind.safeParse(file);

			return kind.success ? [[name, kind.data]] : [];
		}),
	);

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

/** The answers file the skill writes: `{ "hum": {...}, "waitHours": {...}, "schemaVersion": 2 }`, with `"ownRunnerOnPublicRepo": true` once the owner agreed to it. */
export const readAnswers = (file: string): SetupAnswers => SetupAnswers.parse(JSON.parse(readFileSync(file, "utf8")));
