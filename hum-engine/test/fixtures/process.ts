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
