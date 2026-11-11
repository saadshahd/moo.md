import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommandTimedOut, exec } from "../src/exec.ts";

const LIMIT_MS = 500;
const GRACE_MS = 100;
const FAR_SOONER_THAN_THE_COMMAND_ENDS_MS = 5000;

const isAlive = (pid: number): boolean => {
	try {
		return process.kill(pid, 0);
	} catch {
		return false;
	}
};

test("a command that ignores the stop signal fails at its limit, naming itself, and takes its own child with it", async () => {
	const folder = mkdtempSync(join(tmpdir(), "hum-exec-"));
	const pidFile = join(folder, "child.pid");
	const script = `trap '' TERM; sleep 60 & echo $! > ${pidFile}; wait`;
	const started = Date.now();

	try {
		const ran = exec("sh", ["-c", script], { timeoutMs: LIMIT_MS, graceMs: GRACE_MS });

		await expect(ran).rejects.toBeInstanceOf(CommandTimedOut);
		await expect(ran).rejects.toThrow(`\`sh -c ${script}\` ran longer than 0.5 seconds and was stopped`);
		expect(Date.now() - started).toBeLessThan(FAR_SOONER_THAN_THE_COMMAND_ENDS_MS);
		expect(isAlive(Number(readFileSync(pidFile, "utf8")))).toBe(false);
	} finally {
		if (existsSync(pidFile) && isAlive(Number(readFileSync(pidFile, "utf8")))) process.kill(Number(readFileSync(pidFile, "utf8")), "SIGKILL");

		rmSync(folder, { recursive: true });
	}
});
