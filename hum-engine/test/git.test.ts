import { expect, test } from "bun:test";
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gitIn, withConfigPinned } from "../src/adapters/git.ts";
import { SHIPPED_COMMAND_TIMEOUT_MS } from "../src/exec.ts";
import { tempDir } from "./fixtures/temp.ts";
import { sh, WorkRepo } from "./fixtures/work-repo.ts";

test("config a run writes after hum pinned it stops hum's git before git runs it, naming the key", async () => {
	const clone = new WorkRepo().worker("run");
	const ran = join(tempDir("fsmonitor"), "ran");
	const monitor = join(tempDir("fsmonitor"), "monitor.sh");
	const git = gitIn(clone, { timeoutMs: SHIPPED_COMMAND_TIMEOUT_MS });
	const pinned = await withConfigPinned(git);

	writeFileSync(monitor, `#!/bin/sh\ntouch ${ran}\n`);
	chmodSync(monitor, 0o755);
	sh(clone, ["config", "core.fsmonitor", monitor]);

	await expect(pinned.raw(["status"])).rejects.toThrow("core.fsmonitor");
	expect(existsSync(ran)).toBe(false);

	await git.raw(["status"]);
	expect(existsSync(ran)).toBe(true);
});
