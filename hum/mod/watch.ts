import type { EngineInterface } from "claude-code";
import type { ViewSource } from "../types";
import { agesShown } from "./view/ages.ts";
import { readOf, statusPathOf, type ViewRead } from "./view/read.ts";
import { runHum } from "./hum.ts";
import { failureOf } from "./says.ts";

type Engine = EngineInterface;

/** What one session's poller saw at its last look. A reload starts it over, which costs one extra read. */
export type Seen = { readonly modified: number; readonly read: ViewRead; readonly shown: string };

const NEVER = -1;

export const NOTHING_SEEN: Seen = { modified: NEVER, read: { kind: "waiting" }, shown: "" };

/** A look's answer: what it found when the file changed, and what the next look starts from. */
export type Look = { readonly found?: ViewSource; readonly seen: Seen };

/** The engine rejects a missing path with the code at the end of the message, not on a `code` field. */
const isMissing = (error: Error): boolean => error.message.endsWith("ENOENT");

const sourceOf = (found: string | Error, path: string): ViewSource => {
	if (!(found instanceof Error)) return { kind: "text", text: found };

	return isMissing(found) ? { kind: "missing", path } : { kind: "failed", message: found.message };
};

/** Where the repo keeps the status file, or why it cannot be told. The engine follows the engine interface past an import only into a function declaration. */
export async function locate($: Engine, cwd: string): Promise<string> {
	const found = await $.process.run(["git", "rev-parse", "--git-common-dir"], { cwd });

	if (found.exitCode !== 0) throw new Error(`${cwd} is not inside a git repository`);

	return statusPathOf({ cwd, commonDir: found.stdout.trim() });
}

/** One look. A new file time reads the file and answers what it found; the same file answers nothing and redraws only when a shown age changed. */
export async function poll($: Engine, path: string, seen: Seen, amberAfterSeconds: number): Promise<Look> {
	const now = await $.clock.now();
	const stat = await $.fs.stat(path).catch((error: Error) => error);

	if (stat instanceof Error) {
		const found = sourceOf(stat, path);

		return { found, seen: { ...seen, modified: NEVER, read: readOf(found) } };
	}

	if (stat.mtimeMs !== seen.modified) {
		const found = sourceOf(await $.fs.read(path).catch((error: Error) => error), path);

		return { found, seen: { ...seen, modified: stat.mtimeMs, read: readOf(found) } };
	}

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
