export const CARD_CODES = { workerDown: "worker-down", tokenExpiring: "token-expiring", tokenRejected: "token-rejected" } as const;

const WORKER_FIX = "Look at the unit's log for the cause. Starting the unit again lets the worker start again.";

const TOKEN_FIX = "Run `claude setup-token`, store it as the CLAUDE_CODE_OAUTH_TOKEN secret and set ciToken.setUp in .hum/hum.json to today.";

const ERROR_EXCERPT = 160;

const kind =
	<Facts>(code: string, fix: string, cause: (facts: Facts) => string) =>
	(facts: Facts) => ({ code, cause: cause(facts), fix });

/** Every card the service layer raises, as a function from the facts it is raised for. */
export const CARD_KINDS = {
	workerSilent: kind(CARD_CODES.workerDown, WORKER_FIX, ({ seconds, ticks }: { seconds: number; ticks: number }) => `The worker has written no heartbeat for ${seconds} seconds, ${ticks} ticks.`),
	workerGaveUp: kind(
		CARD_CODES.workerDown,
		WORKER_FIX,
		({ crashes, windowMinutes, exitCode }: { crashes: number; windowMinutes: number; exitCode: number }) =>
			`The worker exited ${crashes} times in ${windowMinutes} minutes, the last with code ${exitCode}. Restarts have stopped.`,
	),
	tokenExpiring: kind(CARD_CODES.tokenExpiring, TOKEN_FIX, ({ setUp, validUntil }: { setUp: string; validUntil: string }) => `The CI token made on ${setUp} is valid until ${validUntil}.`),
	tokenRejected: kind(CARD_CODES.tokenRejected, TOKEN_FIX, ({ said }: { said: string }) => `claude was refused with a 401: ${said.slice(0, ERROR_EXCERPT)}`),
};
