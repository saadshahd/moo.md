import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import { gitIn, whenGitFailed } from "../adapters/git.ts";
import { type Env, exec, SHIPPED_COMMAND_TIMEOUT_MS } from "../exec.ts";

/** The marketplace hope comes from, by the name its own manifest gives it. */
const MOO_MARKETPLACE = "moo.md";

const MOO_REPO = "https://github.com/saadshahd/moo.md";

const HOPE_PLUGIN = `hope@${MOO_MARKETPLACE}`;

/** The engine's folder: `hum-engine` in a moo.md checkout, `node_modules/@moo.md/hum` in an owner's repo. */
const ENGINE_ROOT = resolve(import.meta.dir, "..", "..");

/** The file the publish job writes beside the package: the moo.md commit it was published from. */
export const RELEASE_FILE = "release.json";

/** What `release.json` holds: the full sha of the moo.md commit the package was published from. */
export const Release = z.object({ commit: z.string().regex(/^[0-9a-f]{40}$/) });

/** A marketplace as a settings file declares it, in the forms `claude plugin marketplace add` takes. */
const Source = z.discriminatedUnion("source", [
	z.looseObject({ source: z.literal("github"), repo: z.string().min(1), ref: z.string().min(1).optional(), path: z.never().optional() }),
	z.looseObject({ source: z.literal("git"), url: z.string().min(1), ref: z.string().min(1).optional(), path: z.never().optional() }),
	z.looseObject({ source: z.literal("url"), url: z.string().min(1) }),
	z.looseObject({ source: z.literal("directory"), path: z.string().min(1) }),
]);

/** What a repo's `.claude/settings.json` says about plugins; every other key is Claude Code's alone. */
export const RepoPlugins = z.looseObject({
	extraKnownMarketplaces: z.record(z.string(), z.looseObject({ source: Source })).default({}),
	enabledPlugins: z.record(z.string(), z.unknown()).default({}),
});

export type RepoPlugins = z.infer<typeof RepoPlugins>;

/**
 * The moo.md commit this engine shipped with: the one its package was published from, or, where the engine runs from
 * a moo.md checkout, that checkout's HEAD. Any other engine has none, and that throws: an unpinned hope could be one
 * this engine was never released beside.
 */
export const shippedCommit = async (): Promise<string> => {
	const file = join(ENGINE_ROOT, RELEASE_FILE);

	if (existsSync(file)) return Release.parse(JSON.parse(readFileSync(file, "utf8"))).commit;

	const git = gitIn(ENGINE_ROOT, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });
	const top = (await git.raw(["rev-parse", "--show-toplevel"]).catch(whenGitFailed(""))).trim();

	if (top === "" || resolve(top) !== resolve(ENGINE_ROOT, "..")) throw new Error(`this engine holds no ${RELEASE_FILE} and sits in no moo.md checkout, so it names no moo.md commit to install hope from`);

	return (await git.raw(["rev-parse", "HEAD"])).trim();
};

const marketplaceArgument = (source: z.infer<typeof Source>, repo: string): string => {
	switch (source.source) {
		case "github":
			return source.ref === undefined ? source.repo : `${source.repo}#${source.ref}`;
		case "git":
			return source.ref === undefined ? source.url : `${source.url}#${source.ref}`;
		case "url":
			return source.url;
		case "directory":
			return isAbsolute(source.path) ? source.path : join(repo, source.path);
	}
};

/** A marketplace fetched from a repo with no `ref` installs whatever its default branch holds at the wake. */
const isUnpinned = (source: z.infer<typeof Source>): boolean => (source.source === "github" || source.source === "git") && source.ref === undefined;

/**
 * The `claude` command lines that install hope and the repo's plugins: moo.md from `mooFolder`, its checkout at the
 * shipped commit, which stands in for any moo.md the settings declare; each other marketplace they declare; then hope
 * and every plugin they enable. A marketplace from a repo with no `ref` throws: its hooks would run in every run as
 * whatever its branch holds that day.
 */
export const pluginCommands = (settings: RepoPlugins, { repo, mooFolder }: { readonly repo: string; readonly mooFolder: string }): string[][] => {
	const declared = Object.entries(settings.extraKnownMarketplaces).filter(([name]) => name !== MOO_MARKETPLACE);
	const unpinned = declared.flatMap(([name, { source }]) => (isUnpinned(source) ? [name] : []));

	if (unpinned.length > 0) throw new Error(`the marketplaces ${unpinned.join(", ")} in .claude/settings.json name no "ref", so a wake would install whatever their default branch holds, and their hooks run in every run. Give each a "ref": a commit SHA, which no push can move.`);

	const marketplaces = declared.map(([, { source }]) => marketplaceArgument(source, repo));
	const enabled = Object.entries(settings.enabledPlugins).flatMap(([id, on]) => (on === true ? [id] : []));

	return [mooFolder, ...marketplaces].map((source) => ["plugin", "marketplace", "add", source]).concat([...new Set([HOPE_PLUGIN, ...enabled])].map((id) => ["plugin", "install", id]));
};

/** The plugin settings of the repo's `.claude/settings.json`; none where it has no such file. */
export const repoPlugins = (repo: string): RepoPlugins => {
	const file = join(repo, ".claude", "settings.json");

	return RepoPlugins.parse(existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {});
};

/** moo.md at `commit`, fetched alone into a new folder under `parent`. */
const checkOutMoo = async (commit: string, parent: string): Promise<string> => {
	const folder = mkdtempSync(join(parent, "hum-moo-"));
	const git = gitIn(folder, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });

	await git.raw(["init", "-q"]);
	await git.raw(["fetch", "-q", "--depth", "1", MOO_REPO, commit]);
	await git.raw(["checkout", "-q", "FETCH_HEAD"]);

	return folder;
};

export type PluginInstall = {
	readonly repo: string;
	readonly env: Env;
	/** Runs `claude` with these arguments; the CLI runs the real binary. */
	readonly claude?: (args: readonly string[]) => Promise<{ readonly exitCode: number | undefined; readonly stdout: string; readonly stderr: string }>;
	/** The moo.md folder to install from; by default a checkout of the shipped commit. */
	readonly mooFolder?: string;
};

/**
 * Installs hope and the repo's plugins for Claude Code in this job. A fresh checkout is a folder Claude Code does not
 * trust, so it skips the marketplaces the repo's settings declare; this adds them as the user's own. The first command
 * that fails throws, naming itself and what claude said.
 */
export const installPlugins = async ({ repo, env, claude = (args) => exec("claude", args, { throwOnError: false, timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS, nodeOptions: { env } }), mooFolder }: PluginInstall): Promise<readonly string[][]> => {
	const commands = pluginCommands(repoPlugins(repo), { repo, mooFolder: mooFolder ?? (await checkOutMoo(await shippedCommit(), env.RUNNER_TEMP ?? tmpdir())) });

	for (const args of commands) {
		const ran = await claude(args);

		if (ran.exitCode !== 0) throw new Error(`claude ${args.join(" ")} exited ${ran.exitCode}: ${(ran.stderr || ran.stdout).trim()}`);
	}

	return commands;
};
