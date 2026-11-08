import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { z } from "zod";
import { type CheckEnv, checkConfig } from "./checks.ts";
import { hashJson } from "./hash.ts";
import { type Migrations, migrateConfig } from "./migrate.ts";
import { invalidConfig, type Problem, type Result } from "./refusal.ts";
import { orMissing, readJson } from "../state/fs.ts";
import { Json } from "./json.ts";
import { HumConfig, Kind } from "./schema.ts";

/** A config as read from disk, before any check: `.hum/` files by their path. */
export type RawConfig = {
	readonly hum: Json;
	/** `kinds/<name>.json` contents, keyed by `<name>`. */
	readonly kinds: Readonly<Record<string, Json>>;
	/** `roles/<name>.md` contents, keyed by `roles/<name>.md`. */
	readonly roles: Readonly<Record<string, string>>;
};

/** A config that passed every check. */
export type Config = {
	readonly hum: HumConfig;
	readonly kinds: Readonly<Record<string, Kind>>;
	readonly roles: Readonly<Record<string, string>>;
	/** Same hash for the same content, whatever the key order. */
	readonly hash: string;
};

export type LoadOptions = { readonly env: CheckEnv; readonly migrations?: Migrations; readonly current?: number; readonly readable?: readonly number[] };

const malformed = (where: string, error: z.ZodError): Result<never> => ({
	ok: false,
	refusal: { code: "malformed-config", where, message: `${where} is malformed:\n${z.prettifyError(error)}` },
});

/** Migrates, parses and checks a config. Refuses with one typed value; never throws on bad input. */
export const loadConfig = (raw: RawConfig, { env, ...migration }: LoadOptions): Result<Config> => {
	const migrated = migrateConfig(raw.hum, migration);

	if (!migrated.ok) return migrated;
	const hum = HumConfig.safeParse(migrated.value);

	if (!hum.success) return malformed("hum.json", hum.error);

	const kinds: Record<string, Kind> = {};
	const listed: Record<string, Json> = {};
	const missing: Problem[] = [];

	for (const name of hum.data.kinds) {
		const file = raw.kinds[name];

		if (file === undefined) {
			missing.push({ problem: "missing-file", file: `kinds/${name}.json` });
			continue;
		}

		const kind = Kind.safeParse(file);

		if (!kind.success) return malformed(`kinds/${name}.json`, kind.error);
		kinds[name] = kind.data;
		listed[name] = file;
	}

	const problems = [...missing, ...checkConfig(hum.data, kinds, new Set(Object.keys(raw.roles)), env)];

	if (problems.length > 0) return { ok: false, refusal: invalidConfig(problems) };

	return {
		ok: true,
		value: { hum: hum.data, kinds, roles: raw.roles, hash: hashJson({ hum: migrated.value, kinds: listed, roles: raw.roles }) },
	};
};

const scan = (pattern: string, cwd: string): string[] => orMissing(() => [...new Bun.Glob(pattern).scanSync({ cwd, onlyFiles: true })].sort(), []);

const filesIn = (folder: string, extension: string): string[] => scan(`*${extension}`, folder);

/** Reads `hum.json`, `kinds/*.json` and `roles/*.md` from a `.hum/`-shaped folder. */
export const readConfigDir = (dir: string): RawConfig => ({
	hum: readJson(join(dir, "hum.json")),
	kinds: Object.fromEntries(filesIn(join(dir, "kinds"), ".json").map((file) => [basename(file, ".json"), readJson(join(dir, "kinds", file))])),
	roles: Object.fromEntries(filesIn(join(dir, "roles"), ".md").map((file) => [`roles/${file}`, readFileSync(join(dir, "roles", file), "utf8")])),
});

/** The skill names (`intent`, not `hope:intent`) in a hope plugin folder's `skills/*\/SKILL.md`. */
export const listHopeSkills = (hopeRoot: string): ReadonlySet<string> =>
	new Set(scan("*/SKILL.md", join(hopeRoot, "skills")).map((file) => dirname(file)));
