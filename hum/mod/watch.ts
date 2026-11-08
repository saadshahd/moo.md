import type { EngineInterface } from "claude-code";
import type { ViewSource } from "../types";
import { agesShown } from "./view/ages.ts";
import { type ViewRead, statusPathOf } from "./view/read.ts";

type Engine = EngineInterface;

/** What one session's poller remembers between looks. A reload starts it over, which costs one extra read. */
export type Watch = {
	path: string;
	lastModified: number;
	lastRead: ViewRead;
	lastShown: string;
};

const NEVER = -1;

export const newWatch = (): Watch => ({ path: "", lastModified: NEVER, lastRead: { kind: "waiting" }, lastShown: "" });

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

	return statusPathOf(cwd, found.stdout.trim());
}

/** One look. A new file time reads the file and answers what it found; the same file answers nothing and redraws only when a shown age changed. */
export async function poll($: Engine, watch: Watch, amberAfterSeconds: number): Promise<ViewSource | undefined> {
	const now = await $.clock.now();
	const stat = await $.fs.stat(watch.path).catch((error: Error) => error);

	if (stat instanceof Error) {
		watch.lastModified = NEVER;

		return sourceOf(stat, watch.path);
	}

	if (stat.mtimeMs !== watch.lastModified) {
		const text = await $.fs.read(watch.path).catch((error: Error) => error);

		watch.lastModified = stat.mtimeMs;

		return sourceOf(text, watch.path);
	}

	const shown = watch.lastRead.kind === "status" ? agesShown(watch.lastRead.status, now, amberAfterSeconds) : "";

	if (shown !== watch.lastShown) {
		watch.lastShown = shown;
		$.ui.invalidate("ui.render");
	}

	return undefined;
}
