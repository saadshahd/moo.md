import { expect, test } from "bun:test";
import { rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SHIPPED_DEFAULTS } from "../src/config/schema.ts";
import { renderUnit } from "../src/service/unit.ts";
import { readHeartbeat, readStatus } from "../src/status/file.ts";
import { MAIN, ownerRepo } from "./fixtures/owner-repo.ts";
import { sh } from "./fixtures/work-repo.ts";
import { tempDir } from "./fixtures/temp.ts";

const live = process.env.HUM_LIVE === "1" && process.platform === "darwin";

if (!live) console.log("skip scratch launchd unit: set HUM_LIVE=1 on a Mac to load a unit labelled md.moo.hum.scratch.* with a stand-in claude, then unload it");

const launchctl = (...args: string[]) => Bun.spawnSync(["launchctl", ...args]);

const isAlive = (pattern: string): boolean => Bun.spawnSync(["pgrep", "-f", "--", pattern]).exitCode === 0;

test.skipIf(!live)("a scratch launchd unit starts the script, which runs the worker, and unloads clean", async () => {
	const label = `md.moo.hum.scratch.${process.pid}.${Date.now()}`;
	const domain = `gui/${process.getuid?.() ?? 501}`;
	const o = ownerRepo({ items: { a: { writeForItem: true } } });
	const dir = tempDir("launchd");
	const plist = join(dir, `${label}.plist`);
	const log = join(dir, "unit.log");
	const state = join(o.repo.owner, ".git", "hum");

	o.item("a");
	// The unit's PATH is bare: the stand-in claude, bun's folder and the system folders, and nothing else.
	writeFileSync(
		plist,
		renderUnit("launchd", {
			label,
			repo: o.repo.owner,
			command: [process.execPath, MAIN, "serve", "--", "--holder", label],
			path: [dirname(o.shim.binary), dirname(process.execPath), "/usr/bin", "/bin"].join(":"),
			env: { ...o.shim.env, HOME: o.home, HUM_HOPE_ROOT: o.env.HUM_HOPE_ROOT },
			log,
			restartDelaySeconds: SHIPPED_DEFAULTS.restartDelaySeconds,
		}),
	);

	try {
		const loaded = launchctl("bootstrap", domain, plist);

		expect(loaded.stderr.toString()).toBe("");
		expect(launchctl("print", `${domain}/${label}`).exitCode).toBe(0);

		// The program did something: the worker merged the item and wrote its heartbeat and status.
		for (let waited = 0; waited < 30_000 && !readHeartbeat(join(state, "heartbeat.json")); waited += 250) await Bun.sleep(250);

		expect(readHeartbeat(join(state, "heartbeat.json"))).toMatchObject({ engineVersion: expect.any(String) });
		expect(readStatus(join(state, "status.json")).ok).toBe(true);

		for (let waited = 0; waited < 30_000 && sh(o.repo.remote, ["ls-tree", "-r", "--name-only", "main"]).includes("docs/a.md") === false; waited += 250) await Bun.sleep(250);

		expect(sh(o.repo.remote, ["show", "main:docs/a.md"])).toBe("from a\n");
		expect(isAlive(`--holder ${label}`)).toBe(true);
	} finally {
		launchctl("bootout", `${domain}/${label}`);
		rmSync(plist, { force: true });
	}

	// `bootout` returns before launchd has stopped the job. Unloaded means launchd no longer knows the label and no process it started survives.
	const isKnown = () => launchctl("print", `${domain}/${label}`).exitCode === 0;

	for (let waited = 0; waited < 15_000 && (isKnown() || isAlive(`--holder ${label}`)); waited += 250) await Bun.sleep(250);

	expect(isKnown()).toBe(false);
	expect(isAlive(`--holder ${label}`)).toBe(false);
}, 90_000);
