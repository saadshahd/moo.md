import type { Faults } from "../state/faults.ts";
import { DAY_MS } from "../time.ts";
import { CARD_CODES, CARD_KINDS } from "./cards.ts";

/** `claude setup-token` makes a one-year token. */
export const TOKEN_LIFE_DAYS = 365;

/** What `claude -p` prints for a rejected token: `Failed to authenticate. API Error: 401 Invalid bearer token`. */
export const UNAUTHORIZED = /API Error: 401|Failed to authenticate/i;

/** One card on the first 401. Items wait where they are until the token is renewed. */
export const raiseRejectedToken = (faults: Faults, said: string) => faults.raise(CARD_KINDS.tokenRejected({ said }));

/** One card from `warnDays` before the token's year ends; it clears when `setUp` moves to a later day. */
export const checkTokenAge = (faults: Faults, { setUp, now, warnDays }: { readonly setUp: string; readonly now: number; readonly warnDays: number }): void => {
	const expires = Date.parse(setUp) + TOKEN_LIFE_DAYS * DAY_MS;

	if (now < expires - warnDays * DAY_MS) return faults.clear({ code: CARD_CODES.tokenExpiring });

	faults.raise(CARD_KINDS.tokenExpiring({ setUp, validUntil: new Date(expires).toISOString().slice(0, 10) }));
};
