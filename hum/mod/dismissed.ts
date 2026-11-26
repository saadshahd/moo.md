import type { EngineInterface, FsStat } from "claude-code";
import type { Card } from "../../hum-engine/src/status/format.ts";
import type { Dismissal } from "../types";
import { keptDismissals } from "./view/faults.ts";
import { isMissing } from "./watch.ts";

type Engine = EngineInterface;

const isDismissal = (value: unknown): value is Dismissal =>
	typeof value === "object" && value !== null && "key" in value && "since" in value && typeof value.key === "string" && typeof value.since === "number";

/** The dismissals file holds a JSON list of `{ key, since }`. */
const parseDismissed = (text: string): readonly Dismissal[] => {
	const parsed: unknown = JSON.parse(text);

	if (!Array.isArray(parsed) || !parsed.every(isDismissal)) throw new Error("it holds something other than a list of { key, since }");

	return parsed;
};

const unreadable =
	(path: string) =>
	(error: Error): Error =>
		new Error(`the dismissed fault cards at ${path} cannot be read: ${error.message}`);

/** How the dismissals file stood at a look: its file time, or why it could not be told. */
const MISSING = -2;
const FAILED = -3;

export const NOTHING_DISMISSED_SEEN = -1;

const seenOf = (stat: FsStat | Error): number => (stat instanceof Error ? (isMissing(stat) ? MISSING : FAILED) : stat.mtimeMs);

/** A look's answer: what the file holds when it changed since `seen` (none where it is missing, the cause where it cannot be read), and what the next look starts from. */
export type DismissedLook = { readonly found?: readonly Dismissal[] | Error; readonly seen: number };

/** One look at the dismissals file; a file that did not change answers nothing. */
export async function lookDismissed($: Engine, path: string, seen: number): Promise<DismissedLook> {
	const stat = await $.fs.stat(path).catch((error: Error) => error);
	const now = seenOf(stat);

	if (now === seen) return { seen };

	if (stat instanceof Error) return { found: isMissing(stat) ? [] : unreadable(path)(stat), seen: now };

	return { found: await $.fs.read(path).then(parseDismissed).catch(unreadable(path)), seen: now };
}

/** Adds `added` to the repo's dismissals, read again so another pane's stay, keeping one per card of `cards` still raised. Writes only the pane's own file. */
export async function dismiss($: Engine, path: string, added: readonly Dismissal[], cards: readonly Card[]): Promise<Dismissal[]> {
	const found = await $.fs.read(path).then(parseDismissed, (error: Error) => {
		if (isMissing(error)) return [];

		throw unreadable(path)(error);
	});

	const kept = keptDismissals(cards, [...found, ...added]);

	await $.fs.write(path, `${JSON.stringify(kept)}\n`);

	return kept;
}
