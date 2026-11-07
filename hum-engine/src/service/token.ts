import type { Faults } from "../state/faults.ts";

const DAY_MS = 86_400_000;

/** `claude setup-token` makes a one-year token (D6). */
export const TOKEN_LIFE_DAYS = 365;

/** The card shows this long before the token's year ends (D6). */
export const TOKEN_WARN_DAYS = 30;

const FIX = "Run `claude setup-token`, store it as the CLAUDE_CODE_OAUTH_TOKEN secret and set ciToken.setUp in .hum/hum.json to today.";

/** What `claude -p` prints for a rejected token: `Failed to authenticate. API Error: 401 Invalid bearer token`. */
export const UNAUTHORIZED = /API Error: 401|Failed to authenticate/i;

/** D6: one card on the first 401. Items wait where they are until the token is renewed. */
export const rejectedToken = (faults: Faults, said: string) =>
	faults.raise({ code: "token-rejected", cause: `claude was refused with a 401: ${said.slice(0, 160)}`, fix: FIX });

/** D6: one card from 30 days before the token's year ends; it clears when `setUp` moves to a later day. */
export const checkTokenAge = (faults: Faults, setUp: string, now: number): void => {
	const expires = Date.parse(setUp) + TOKEN_LIFE_DAYS * DAY_MS;

	if (now < expires - TOKEN_WARN_DAYS * DAY_MS) return faults.clear("token-expiring");

	const day = new Date(expires).toISOString().slice(0, 10);

	faults.raise({ code: "token-expiring", cause: `The CI token made on ${setUp} is valid until ${day}.`, fix: FIX });
};
