/** Waits until `condition` holds, and fails once `timeoutMs` has passed without it. */
export const until = async (condition: () => boolean, timeoutMs = 10_000): Promise<void> => {
	const deadline = Date.now() + timeoutMs;

	while (!condition()) {
		if (Date.now() > deadline) throw new Error("timed out waiting for the condition");

		await Bun.sleep(5);
	}
};

/** A process that has exited is dead, though it answers `kill(pid, 0)` until its new parent reaps it. */
export const isAlive = (pid: number): boolean => /^[^Z]/.test(Bun.spawnSync(["ps", "-o", "stat=", "-p", String(pid)]).stdout.toString().trim());

/** The GitHub tokens a CI wake's hum holds in its own `process.env`, where every child it starts would inherit them. */
const HELD_TOKENS = { GH_TOKEN: "ghs_app", GITHUB_TOKEN: "ghs_workflow" } as const;

/** Runs `body` while this process holds the GitHub tokens in its own env, as hum does in a CI wake, and takes them out after. */
export const holdingGitHubTokens = async <T>(body: () => Promise<T>): Promise<T> => {
	Object.assign(process.env, HELD_TOKENS);

	try {
		return await body();
	} finally {
		for (const name of Object.keys(HELD_TOKENS)) delete process.env[name];
	}
};
