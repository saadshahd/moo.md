import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import semver from "semver";
import { z } from "zod";
import { type Git, gitIn } from "../adapters/git.ts";
import type { GitHubCommits } from "../adapters/github-commits.ts";
import { landOwnerCommit } from "../adapters/owner-commit.ts";
import type { PullRequests } from "../adapters/pull-requests.ts";
import type { HumConfig } from "../config/schema.ts";
import { growthLabelsOf } from "../decide/growth.ts";
import { addEngineCommand, ENGINE_NAME, installedCli, LOCAL_PIN, pinOf } from "../engine.ts";
import { exec } from "../exec.ts";
import { lockfileIn, pinningManagerIn } from "../setup/scan.ts";
import { ADD_EXACT, INSTALL_COMMANDS } from "../setup/tables.ts";
import type { EngineUpdate } from "../state/saved.ts";
import { installedVersion } from "./signature.ts";
import { pushCommits } from "./signed-push.ts";

/** Where the worker keeps the base its engine look read, so a fetch elsewhere cannot move it before the checkout follows. */
const ENGINE_REF = "refs/hum/engine-base";

/** The last lines of a failed command that a card quotes. */
const SAID_LINES = 12;

/** pnpm names this setting where its minimumReleaseAge refuses a version too new to install. */
const RELEASE_AGE_EXCLUDE = "minimumReleaseAgeExclude";

/** The file that holds pnpm's release-age policy; pnpm rewrites an exclude that names the engine at one version. */
const PNPM_WORKSPACE = "pnpm-workspace.yaml";

/** What `installedVersion` reads where nothing is installed. */
const NONE = "none";

/** The owner's checkout, the remote and base an engine's pin lands on, and how long one command may run. */
export type EngineHome = { readonly repo: string; readonly remote: string; readonly base: string; readonly timeoutMs: number };

/** What the worker does about its engine at one look; `base` is the commit of the base the look read. */
export type EngineStep =
	| { readonly kind: "current" }
	/** Something stops the update; the card says what. */
	| { readonly kind: "held"; readonly cause: string; readonly fix: string }
	/** The base pins another engine: the checkout takes it once the worker's runs end. */
	| { readonly kind: "adopt"; readonly version: string; readonly base: string }
	/** A newer engine is out: its pin goes onto the base. */
	| { readonly kind: "bump"; readonly version: string; readonly base: string };

const CURRENT: EngineStep = { kind: "current" };

/** The last lines a command printed. */
const saidBy = ({ stdout, stderr }: { readonly stdout: string; readonly stderr: string }): string => `${stdout}\n${stderr}`.trim().split("\n").slice(-SAID_LINES).join("\n");

/** How a command ended: nothing where it exited 0, else what it said last. */
const failureOf = async (line: string, args: readonly string[], cwd: string, timeoutMs: number): Promise<string | undefined> => {
	const [command = "", ...words] = line.split(" ");

	try {
		const ran = await exec(command, [...words, ...args], { timeoutMs, nodeOptions: { cwd } });

		return ran.exitCode === 0 ? undefined : `${[line, ...args].join(" ")} exited ${ran.exitCode}: ${saidBy(ran)}`;
	} catch (error) {
		return `${[line, ...args].join(" ")} failed: ${error instanceof Error ? error.message : String(error)}`;
	}
};

/** The base on the remote, kept at `ENGINE_REF`: its commit and the engine its package.json pins. */
const readBase = async (git: Git, { remote, base }: EngineHome): Promise<{ readonly sha: string; readonly pin: string | undefined }> => {
	await git.raw(["fetch", "-q", remote, `+refs/heads/${base}:${ENGINE_REF}`]);

	const manifest = await git.run(["show", `${ENGINE_REF}:package.json`]);

	return { sha: (await git.raw(["rev-parse", ENGINE_REF])).trim(), pin: manifest.code === 0 ? pinOf(manifest.stdout) : undefined };
};

/** Why the checkout cannot take another engine, or nothing: it is on the base, changes no tracked file, and holds no commit the base lacks. */
const checkoutRefusal = async (git: Git, base: string): Promise<string | undefined> => {
	const branch = (await git.run(["symbolic-ref", "-q", "--short", "HEAD"])).stdout.trim();

	if (branch !== base) return branch === "" ? `has no branch checked out, where hum needs ${base}` : `is on ${branch}, where hum needs ${base}`;

	const changed = (await git.raw(["status", "--porcelain", "--untracked-files=no"])).split("\n").filter(Boolean);

	if (changed.length > 0) return `changes ${changed.map((line) => line.slice(3)).join(", ")}`;

	return (await git.run(["merge-base", "--is-ancestor", "HEAD", ENGINE_REF])).code === 0 ? undefined : `holds commits ${base} on the remote lacks`;
};

/**
 * What the worker does about its engine: take the engine the base pins where it is not the one running, else pin the
 * newest published one where it is newer. A version that failed waits until the base moves past where it failed, and
 * one whose pin waits in a pull request waits for that; both only in a clean checkout of the base. A base that pins no
 * engine, or one on disk, or no exact version, is the owner's to move.
 */
export const engineStep = async (home: EngineHome, { running, latest, tried }: { readonly running: string; readonly latest: string | undefined; readonly tried: (version: string) => EngineUpdate | undefined }): Promise<EngineStep> => {
	const git = gitIn(home.repo, { timeoutMs: home.timeoutMs });
	const onBase = await readBase(git, home);
	const { pin } = onBase;

	if (pin === undefined || LOCAL_PIN.test(pin) || semver.valid(pin) === null) return CURRENT;

	const wanted =
		pin !== running
			? ({ kind: "adopt", version: pin, base: onBase.sha } as const)
			: latest !== undefined && semver.valid(latest) !== null && semver.gt(latest, running)
				? ({ kind: "bump", version: latest, base: onBase.sha } as const)
				: undefined;

	if (wanted === undefined) return CURRENT;

	const record = tried(wanted.version);

	if (record?.outcome === "failed" && record.base === onBase.sha) return { kind: "held", cause: record.cause, fix: record.fix };

	if (record?.outcome === "opened" && wanted.kind === "bump") return { kind: "held", cause: `The pin of hum ${wanted.version} waits in ${record.pull}.`, fix: `Merge it; hum installs ${wanted.version} once ${home.base} pins it.` };

	const refusal = await checkoutRefusal(git, home.base);

	if (refusal !== undefined) {
		return {
			kind: "held",
			cause: `hum ${wanted.version} ${wanted.kind === "adopt" ? `is pinned on ${home.base}` : "is out"}, and the checkout ${refusal}.`,
			fix: `Commit or drop those changes and check out ${home.base}; hum updates itself at its next look.`,
		};
	}

	return wanted;
};

export type BumpOptions = EngineHome & {
	readonly version: string;
	readonly running: string;
	readonly hum: Pick<HumConfig, "commitIdentity" | "ownerBranchPrefix" | "mergeMethod" | "alwaysPullRequest" | "growthLabels">;
	readonly pulls: PullRequests | undefined;
	readonly commits: GitHubCommits | undefined;
};

/** How pinning a newer engine on the base ended. */
export type Bumped =
	| { readonly kind: "landed" }
	/** Another writer moved the base first. */
	| { readonly kind: "conflict" }
	/** The pin waits in a pull request. */
	| { readonly kind: "opened"; readonly pull: string }
	| { readonly kind: "failed"; readonly cause: string; readonly fix: string };

/** The answer `hum setup upgrade` prints: the files it rewrote, or what only the owner can answer. */
const Upgraded = z.union([z.object({ written: z.array(z.string()) }), z.object({ refused: z.string().min(1) })]);

const upgradedOf = (stdout: string): z.infer<typeof Upgraded> | undefined => {
	try {
		return Upgraded.safeParse(JSON.parse(stdout.trim().split("\n").at(-1) ?? "")).data;
	} catch {
		return undefined;
	}
};

/**
 * Pins `version` on the base from a fresh clone, so the owner's checkout stays as it is: the repo's package manager
 * pins it in the field that holds it, the new engine's `hum setup upgrade` rewrites the setup files it writes, and
 * the commit holds only those, package.json and the lockfile. It lands as any commit of the owner's does.
 */
export const bumpEngine = async (o: BumpOptions): Promise<Bumped> => {
	const scratch = mkdtempSync(join(tmpdir(), "hum-engine-"));
	const retry = `hum tries ${o.version} again once ${o.base} moves.`;
	const exemptByName = `Exempt ${ENGINE_NAME} by name in ${PNPM_WORKSPACE}, as \`${RELEASE_AGE_EXCLUDE}: ["${ENGINE_NAME}"]\`, or wait out minimumReleaseAge; ${retry}`;
	const failed = (cause: string, fix = retry): Bumped => ({ kind: "failed", cause: `Updating hum from ${o.running} to ${o.version} failed: ${cause}`, fix });

	try {
		await gitIn(tmpdir(), { timeoutMs: o.timeoutMs }).raw(["clone", "-q", "--branch", o.base, o.remote, scratch]);
		appendFileSync(join(scratch, ".git", "info", "exclude"), "node_modules/\n");

		const manager = pinningManagerIn(scratch);
		const lockfile = lockfileIn(scratch)?.file;

		if (manager === undefined || lockfile === undefined) return failed(`${o.base} holds no lockfile of ${Object.keys(ADD_EXACT).join(", ")}`);

		const add = addEngineCommand(manager, o.version);
		const unadded = await failureOf(ADD_EXACT[manager], [`${ENGINE_NAME}@${o.version}`], scratch, o.timeoutMs);

		if (unadded !== undefined) return failed(unadded, unadded.includes(RELEASE_AGE_EXCLUDE) ? exemptByName : retry);

		const installed = installedVersion(scratch, NONE);

		if (installed !== o.version) return failed(`${add} installed ${installed}`);

		const upgrade = await exec(process.execPath, [installedCli(scratch), "setup", "upgrade"], { timeoutMs: o.timeoutMs, nodeOptions: { cwd: scratch } });
		const upgraded = upgradedOf(upgrade.stdout);

		if (upgraded !== undefined && "refused" in upgraded && upgrade.exitCode !== 0) return { kind: "failed", cause: `hum ${o.version} needs your answer before it runs here: ${upgraded.refused}`, fix: `Run ${add}, then /hum to answer; ${retry}` };

		if (upgraded === undefined || !("written" in upgraded) || upgrade.exitCode !== 0) return failed(`hum ${o.version}'s \`hum setup upgrade\` exited ${upgrade.exitCode}: ${saidBy(upgrade)}`);

		const git = gitIn(scratch, { identity: o.hum.commitIdentity, timeoutMs: o.timeoutMs });
		const changed = (await git.raw(["status", "--porcelain", "--untracked-files=all"])).split("\n").filter(Boolean).map((line) => line.slice(3));
		const expected = new Set(["package.json", lockfile, ...upgraded.written]);
		const strays = changed.filter((path) => !expected.has(path));

		if (strays.length > 0) return failed(`it also changed ${strays.join(", ")}, which hum leaves to the owner`, strays.includes(PNPM_WORKSPACE) ? exemptByName : `Update by hand with ${add}; ${retry}`);

		await git.raw(["add", "--", ...changed]);

		const title = `hum: update the engine to ${o.version}`;
		const body = `hum updated itself from ${o.running} to ${o.version} with ${add}${upgraded.written.length > 0 ? `, and hum ${o.version} rewrote ${upgraded.written.join(", ")}` : ""}.`;

		await git.raw(["commit", "-q", "-m", title, "-m", body]);

		const sha = (await git.raw(["rev-parse", "HEAD"])).trim();

		const landed = await landOwnerCommit({
			sha,
			base: o.base,
			label: `engine-${o.version}`,
			title,
			body,
			branchPrefix: o.hum.ownerBranchPrefix,
			mergeMethod: o.hum.mergeMethod,
			alwaysPullRequest: o.hum.alwaysPullRequest,
			labels: await growthLabelsOf(git, { base: `${sha}^`, head: sha }, o.hum.growthLabels),
			pulls: o.pulls,
			push: (refspecs) => pushCommits({ git, base: o.base, pulls: o.pulls, commits: o.commits }, refspecs),
		});

		switch (landed.via) {
			case "push":
				return { kind: "landed" };
			case "conflict":
				return { kind: "conflict" };
			case "pull-request":
				return landed.merged ? { kind: "landed" } : { kind: "opened", pull: landed.pull.url };
			case "refused":
				return failed(`${o.base} refused the pin: ${landed.said}`, `Pin it by hand with ${add}; ${retry}`);
		}
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
};

/** How the checkout took the engine the base pins. */
export type Adopted = { readonly ok: true } | { readonly ok: false; readonly cause: string; readonly fix: string };

/**
 * Moves the checkout to the base its engine look read, as a fast-forward, and installs from the lockfile there. Where
 * either fails or another engine comes of it, the checkout goes back to where it was and installs again, so the engine
 * it runs stays installed.
 */
export const adoptEngine = async (home: EngineHome, { version, running }: { readonly version: string; readonly running: string }): Promise<Adopted> => {
	const git = gitIn(home.repo, { timeoutMs: home.timeoutMs });
	const manager = lockfileIn(home.repo)?.manager;
	const from = (await git.raw(["rev-parse", "HEAD"])).trim();

	const install = async (wants: string): Promise<string | undefined> => {
		if (manager === undefined) return "the checkout holds no lockfile";

		const failure = await failureOf(INSTALL_COMMANDS[manager], [], home.repo, home.timeoutMs);
		const installed = installedVersion(home.repo, NONE);

		return failure ?? (installed === wants ? undefined : `${INSTALL_COMMANDS[manager]} installed ${installed}`);
	};

	const moved = await git.run(["merge", "--ff-only", "-q", ENGINE_REF]);
	const failure = moved.code === 0 ? await install(version) : `git merge --ff-only ${home.base} failed: ${moved.stderr.trim()}`;

	if (failure === undefined) return { ok: true };

	const reset = await git.run(["reset", "-q", "--keep", from]);
	const unrestored = reset.code === 0 ? await install(running) : `git reset --keep ${from} failed: ${reset.stderr.trim()}`;

	return {
		ok: false,
		cause: `Installing hum ${version} in the checkout failed: ${failure}. ${unrestored === undefined ? `The checkout is back on ${running}.` : `Putting ${running} back failed too: ${unrestored}`}`,
		fix: `hum tries ${version} again once ${home.base} moves; run the install in the checkout to see the cause.`,
	};
};
