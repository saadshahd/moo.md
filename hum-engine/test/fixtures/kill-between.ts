// Child process for the E2 fault test: one external op, killed with SIGKILL at a chosen point.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openState } from "../../src/index.ts";

const [dir, mode] = process.argv.slice(2);

if (!dir || !mode) throw new Error("usage: kill-between.ts <state dir> <before-op|after-op|finish>");

const provider = join(dir, "provider.txt");
const key = { itemId: "#68", run: "build", attempt: 1, op: "comment" };
const marker = `hum-op ${JSON.stringify(key)}`;
const kill = () => process.kill(process.pid, "SIGKILL");

await openState(dir).ops.once(key, {
	holds: async () => existsSync(provider) && readFileSync(provider, "utf8").includes(marker),
	run: async () => {
		if (mode === "before-op") kill();

		appendFileSync(provider, `${marker}\n`);

		if (mode === "after-op") kill();
	},
});
