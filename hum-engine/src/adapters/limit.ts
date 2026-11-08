import type { State } from "../state/open.ts";
import { SECOND_MS } from "../time.ts";
import { CARD_EXCERPT, type Card } from "../status/format.ts";

const LIMIT_KEY = "runner";

export const LIMIT_UNPARSED = "limit-unparsed";

/** Epoch ms until which the saved usage limit holds every run, or 0. */
export const savedLimitUntil = (state: Pick<State, "limit">): number => state.limit.get(LIMIT_KEY)?.until ?? 0;

export const LIMIT_TEXT = /usage limit|hit your (?:\w+ )?limit|limit reached/i;

const LIMIT_EPOCH = /limit reached\|(\d{9,13})/i;

const LIMIT_ISO = /resets?(?: at)? (\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:\d\d))/i;

/** Epoch values below this are seconds, at or above it milliseconds. */
const FIRST_MS_EPOCH = 1e12;

export const epochMs = (value: number): number => (value < FIRST_MS_EPOCH ? value * SECOND_MS : value);

const isoMs = (text: string | undefined): number | undefined => {
	const parsed = text === undefined ? Number.NaN : Date.parse(text);

	return Number.isNaN(parsed) ? undefined : parsed;
};

/** The reset time in a limit message, as epoch ms. Undefined when the message holds none this parser knows. */
export const parseLimit = (text: string): number | undefined => {
	const epoch = LIMIT_EPOCH.exec(text)?.[1];

	return epoch === undefined ? isoMs(LIMIT_ISO.exec(text)?.[1]) : epochMs(Number(epoch));
};

/** A usage limit a run ended on: with its reset time, or with a message no parser here reads. */
export type LimitEnded = { readonly kind: "limited"; readonly until: number } | { readonly kind: "limit-unparsed"; readonly text: string };

/** The limit a refusal names: its structured reset time when it has one, else the time in its text. */
export const limitOf = (text: string, resetsAt: number | undefined): LimitEnded => {
	const until = resetsAt ?? parseLimit(text);

	return until === undefined ? { kind: "limit-unparsed", text } : { kind: "limited", until };
};

export type Held = { readonly kind: "held"; readonly card: Card };

/**
 * A run that ended on a usage limit, taken by the engine: the reset time is saved so no call is made before it ends,
 * and a message with no readable reset time holds every run with one card.
 */
export const settleLimit = (state: Pick<State, "limit" | "faults">, ended: LimitEnded): { readonly kind: "limited"; readonly until: number } | Held => {
	if (ended.kind === "limit-unparsed") {
		return {
			kind: "held",
			card: state.faults.raise({
				code: LIMIT_UNPARSED,
				cause: `claude refused with a usage limit and no reset time hum can read: ${ended.text.slice(0, CARD_EXCERPT)}`,
				fix: "Runs stay held. Tell hum's maintainer the message, or restart the worker once the limit has reset.",
			}),
		};
	}

	state.limit.put(LIMIT_KEY, { until: Math.max(savedLimitUntil(state), ended.until) });

	return ended;
};
