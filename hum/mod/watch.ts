import type { EngineInterface, FsStat } from "claude-code";
import type { ServedSource, ViewSource } from "../types";
import { agesShown } from "./view/ages.ts";
import { dismissedPathOf, readOf, statusPathOf, type ViewRead } from "./view/read.ts";
import { engineAt, runHum } from "./hum.ts";
import { failureOf } from "./says.ts";

type Engine = EngineInterface;

/** Where a repo keeps what the mod reads and runs: its root, which holds hum's config and pinned engine, the status file hum's worker writes, and the pane's dismissals beside it. */
export type Place = { readonly root: string; readonly statusPath: string; readonly dismissedPath: string };

/** The config a repo where hum is set up holds, under its root. */
const CONFIG = ".hum/hum.json";

/** Where hum does not serve: it is not set up in the repo, or its worker never wrote the status file. */
export const UNSERVED: ViewSource = { kind: "unserved" };

/** What one session's poller saw at its last look: nothing yet known, a repo where hum does not serve, or the status file as last read. A reload starts it over, which costs one extra read. */
export type Seen =
	| { readonly kind: "unknown" }
	| { readonly kind: "unserved" }
	| { readonly kind: "served"; readonly modified: number; readonly read: ViewRead; readonly shown: string };

export const NOTHING_SEEN: Seen = { kind: "unknown" };

/** A look's answer: what it found when that changed, and what the next look starts from. */
export type Look = { readonly found?: ViewSource; readonly seen: Seen };

const NEVER = -1;

/** The engine rejects a missing path with the code at the end of the message, not on a `code` field. */
export const isMissing = (error: Error): boolean => error.message.endsWith("ENOENT");

const sourceOf = (found: string | Error): ServedSource => (found instanceof Error ? { kind: "failed", message: found.message } : { kind: "text", text: found });

/** A look at a status file it read: what it found, and its file time and shown ages for the next look. */
const servedLook = (found: ServedSource, modified: number, shown: string): Look => ({ found, seen: { kind: "served", modified, read: readOf(found), shown } });

/** Where the repo at `cwd` keeps its root and status file; nothing outside a git repository or where git does not run. The engine follows the engine interface past an import only into a function declaration. */
export async function locate($: Engine, cwd: string): Promise<Place | undefined> {
	const found = await $.process.run(["git", "rev-parse", "--show-toplevel", "--git-common-dir"], { cwd }).catch(() => undefined);

	if (found?.exitCode !== 0) return undefined;

	const [root = "", commonDir = ""] = found.stdout.trim().split("\n");

	return { root, statusPath: statusPathOf({ cwd, commonDir }), dismissedPath: dismissedPathOf({ cwd, commonDir }) };
}

/** Whether hum is set up at the root: its config and its pinned engine are there. */
async function isSetUp($: Engine, root: string): Promise<boolean> {
	return (await $.fs.exists(`${root}/${CONFIG}`)) && (await $.fs.exists(engineAt(root)));
}

/** The status file's stat where hum serves, nothing where it does not, and the failure when the file is there and cannot be told. */
async function servedStat($: Engine, { root, statusPath }: Place): Promise<FsStat | Error | undefined> {
	if (!(await isSetUp($, root))) return undefined;

	const stat = await $.fs.stat(statusPath).catch((error: Error) => error);

	return stat instanceof Error && isMissing(stat) ? undefined : stat;
}

/** One look. Where hum does not serve it answers that once and nothing after; a new file time reads the file; the same file answers nothing and redraws only when a shown age changed. */
export async function poll($: Engine, place: Place, seen: Seen, amberAfterSeconds: number): Promise<Look> {
	const stat = await servedStat($, place);

	if (stat === undefined) return seen.kind === "unserved" ? { seen } : { found: UNSERVED, seen: { kind: "unserved" } };

	const lastShown = seen.kind === "served" ? seen.shown : "";

	if (stat instanceof Error) return servedLook({ kind: "failed", message: stat.message }, NEVER, lastShown);

	if (seen.kind !== "served" || stat.mtimeMs !== seen.modified) return servedLook(sourceOf(await $.fs.read(place.statusPath).catch((error: Error) => error)), stat.mtimeMs, lastShown);

	const now = await $.clock.now();
	const shown = seen.read.kind === "status" ? agesShown(seen.read.status, { now, amberAfterSeconds }) : "";

	if (shown === seen.shown) return { seen };

	$.ui.invalidate("ui.render");

	return { seen: { ...seen, shown } };
}

/** A timer's callback that starts `run` only once its last run has ended, so a slow `hum watch` is never started again on top of itself. */
export const exclusive = (run: () => Promise<void>): (() => void) => {
	let isRunning = false;

	return () => {
		if (isRunning) return;

		isRunning = true;
		void run().finally(() => {
			isRunning = false;
		});
	};
};

/** The repo's root, where its pinned hum lives. */
export async function repoRoot($: Engine, cwd: string): Promise<string> {
	const found = await $.process.run(["git", "rev-parse", "--show-toplevel"], { cwd });

	if (found.exitCode !== 0) throw new Error(`${cwd} is not inside a git repository`);

	return found.stdout.trim();
}

/** Asks the repo's hum once whether anything changed; the engine shares one read among every session. Answers the failure's cause, or nothing when the read went through. */
export async function watchOnce($: Engine, root: string): Promise<string | undefined> {
	const ran = await runHum($, root, ["watch"]).catch((error: Error) => ({ exitCode: -1, stderr: error.message }));

	return ran.exitCode === 0 ? undefined : failureOf(ran);
}
