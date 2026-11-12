import type { Status } from "../../../hum-engine/src/status/format.ts";
import { ageSeconds, ageText, isAmber } from "./freshness.ts";
import { type Span, span } from "./row.ts";

/** The runners the status file times, in the order the view lists them. */
export const RUNNERS = [
	{ key: "mac", label: "Mac" },
	{ key: "ci", label: "CI" },
] as const;

export type Runner = (typeof RUNNERS)[number];

/** `Mac 40 s`, amber when stale; `suffix` follows the age. A runner that never wrote has no age and no part. */
export const runnerPart = (status: Status, { key, label }: Runner, now: number, amberAfterSeconds: number, suffix = ""): Span | undefined => {
	const wrote = status.workers[key];

	if (wrote === undefined) return undefined;

	const seconds = ageSeconds(wrote, now);

	return span(`${label} ${ageText(seconds)}${suffix}`, isAmber(seconds, amberAfterSeconds) ? "amber" : "plain");
};

/** What the ages show, so a redraw is due when any shown age or its colour changed. */
export const agesShown = (status: Status, now: number, amberAfterSeconds: number): string =>
	RUNNERS.map((runner) => runnerPart(status, runner, now, amberAfterSeconds)?.text ?? "").join("|");
