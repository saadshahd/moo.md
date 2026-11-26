import { afterEach, expect, test } from "bun:test";
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { installedCli, pinOf } from "../src/engine.ts";
import { installedVersion } from "../src/worker/signature.ts";
import type { Worker } from "../src/worker/worker.ts";
import { engineRegistry, refusingCli, upgradingCli } from "./fixtures/engine-registry.ts";
import { tempDir } from "./fixtures/temp.ts";
import { commitFiles, sh } from "./fixtures/work-repo.ts";
import { workerWorld, type WorkerWorld } from "./fixtures/worker-world.ts";

const registries: ReturnType<typeof engineRegistry>[] = [];

afterEach(() => {
	for (const registry of registries.splice(0)) registry.stop();
});

const RUNNING = "1.0.0";

const REFUSAL = "hum.json lacks reviewModel, which only the owner can pick.";

/**
 * A worker on engine 1.0.0 in an owner's checkout that pins it with bun from a registry on localhost holding the
 * engines given, whose newest published version is `latest`. bun keeps its cache in the test's own folder.
 */
const pinnedWorld = async (engines: Readonly<Record<string, string>>, latest: string, scripts: Readonly<Record<string, string>> = {}) => {
	const registry = engineRegistry({ [RUNNING]: upgradingCli(RUNNING), ...engines });
	const w = await workerWorld({});
	const owner = w.repo.owner;

	registries.push(registry);
	commitFiles(
		owner,
		{
			"package.json": JSON.stringify({ name: "owner", private: true, scripts, dependencies: { "@moo.md/hum": RUNNING } }, null, "\t"),
			"bunfig.toml": `[install.scopes]\n"@moo.md" = "${registry.url}"\n\n[install.cache]\ndir = "${tempDir("bun-cache")}"\n`,
			".gitignore": "node_modules/\n",
		},
		"pin hum",
	);

	const install = Bun.spawn(["bun", "install"], { cwd: owner, stdout: "pipe", stderr: "pipe" });

	if ((await install.exited) !== 0) throw new Error(`bun install failed: ${await new Response(install.stderr).text()}`);

	sh(owner, ["add", "-A"]);
	sh(owner, ["commit", "-q", "-m", "lock hum"]);
	sh(owner, ["push", "-q", "origin", "main"]);

	return { w, registry, worker: w.workerWith({ engineVersion: RUNNING, latestVersion: async () => latest }) };
};

const pinOnBase = (w: WorkerWorld): string | undefined => pinOf(sh(w.repo.remote, ["show", "main:package.json"]));

const engineCards = (w: WorkerWorld) => w.state.faults.list().filter(({ code }) => code === "engine-update");

/** One tick and the work it started beside it. */
const tickAndSettle = async (worker: Worker) => {
	const ticked = await worker.tick();

	await worker.idle();

	return ticked;
};

/** Moves the clock past the time between engine looks. */
const nextLook = (w: WorkerWorld) => void (w.clock.at += w.config.hum.latestVersionCacheSeconds * 1000);

test("a worker on engine 1.0.0 pins 1.1.0 on the base with bun and 1.1.0's own setup files, installs it in its checkout and exits for it, so its next start runs 1.1.0", async () => {
	const { w, worker } = await pinnedWorld({ "1.1.0": upgradingCli("1.1.0") }, "1.1.0");

	expect(await tickAndSettle(worker)).toEqual({ kind: "ran", started: [] });
	expect(pinOnBase(w)).toBe("1.1.0");
	expect(sh(w.repo.remote, ["show", "main:.hum/engine.txt"])).toBe("1.1.0\n");

	expect(await tickAndSettle(worker)).toEqual({ kind: "exit", reason: "the base pins hum 1.1.0" });
	expect(sh(w.repo.owner, ["rev-parse", "HEAD"])).toBe(sh(w.repo.remote, ["rev-parse", "main"]));
	expect(installedVersion(w.repo.owner, "none")).toBe("1.1.0");
	expect(Bun.spawnSync(["bun", installedCli(w.repo.owner), "work"], { cwd: w.repo.owner }).stdout.toString()).toBe("hum 1.1.0 work\n");
	expect(engineCards(w)).toEqual([]);
});

test("a release whose own setup needs the owner's answer pins nothing, says so on a card, and is tried again only once the base moves", async () => {
	const { w, worker } = await pinnedWorld({ "1.2.0": refusingCli(REFUSAL) }, "1.2.0");

	const tried = () => w.state.engineUpdates.get("1.2.0");

	await tickAndSettle(worker);
	expect(pinOnBase(w)).toBe(RUNNING);
	expect(engineCards(w).map(({ cause }) => cause)).toEqual([`hum 1.2.0 needs your answer before it runs here: ${REFUSAL}`]);

	const first = tried();

	nextLook(w);
	await tickAndSettle(worker);
	expect(tried()).toEqual(first);

	w.repo.put({ path: "docs/moved.md", content: "the base moved\n" });
	nextLook(w);
	await tickAndSettle(worker);
	expect(tried()).toMatchObject({ outcome: "failed", base: sh(w.repo.remote, ["rev-parse", "main"]).trim(), at: w.clock.at });
	expect(installedVersion(w.repo.owner, "none")).toBe(RUNNING);
});

test("a checkout with a changed tracked file holds the update on a card that names the file, and pins nothing", async () => {
	const { w, registry, worker } = await pinnedWorld({ "1.1.0": upgradingCli("1.1.0") }, "1.1.0");

	writeFileSync(join(w.repo.owner, ".gitignore"), "node_modules/\ndist/\n");

	expect(await tickAndSettle(worker)).toEqual({ kind: "ran", started: [] });
	expect(engineCards(w).map(({ cause }) => cause)).toEqual(["hum 1.1.0 is out, and the checkout changes .gitignore."]);
	expect(registry.fetched("1.1.0")).toBe(0);
	expect(pinOnBase(w)).toBe(RUNNING);
});

test("an install that fails in the checkout puts the checkout and its engine back, shows the cause, and is not tried again on the same base", async () => {
	const { w, worker } = await pinnedWorld({ "1.1.0": upgradingCli("1.1.0") }, "1.1.0", { postinstall: `test ! -f refuse || grep -q '"${RUNNING}"' node_modules/@moo.md/hum/package.json` });
	const before = sh(w.repo.owner, ["rev-parse", "HEAD"]);

	writeFileSync(join(w.repo.owner, "refuse"), "");

	await tickAndSettle(worker);
	expect(pinOnBase(w)).toBe("1.1.0");

	expect(await tickAndSettle(worker)).toEqual({ kind: "ran", started: [] });
	expect(sh(w.repo.owner, ["rev-parse", "HEAD"])).toBe(before);
	expect(installedVersion(w.repo.owner, "none")).toBe(RUNNING);
	expect(engineCards(w).map(({ cause }) => cause)).toEqual([expect.stringMatching(/^Installing hum 1\.1\.0 in the checkout failed: bun install --frozen-lockfile exited 1: .*The checkout is back on 1\.0\.0\.$/s)]);

	nextLook(w);
	expect(await tickAndSettle(worker)).toEqual({ kind: "ran", started: [] });
	expect(installedVersion(w.repo.owner, "none")).toBe(RUNNING);
});

test("a base that refuses the pin's push keeps its pin, and the card quotes the refusal", async () => {
	const { w, worker } = await pinnedWorld({ "1.1.0": upgradingCli("1.1.0") }, "1.1.0");
	const hook = join(w.repo.remote, "hooks", "pre-receive");

	writeFileSync(hook, "#!/bin/sh\necho 'main takes no pushes today' >&2\nexit 1\n");
	chmodSync(hook, 0o755);

	expect(await tickAndSettle(worker)).toEqual({ kind: "ran", started: [] });
	expect(pinOnBase(w)).toBe(RUNNING);
	expect(engineCards(w).map(({ cause }) => cause)).toEqual([expect.stringMatching(/^Updating hum from 1\.0\.0 to 1\.1\.0 failed: main refused the pin: .*main takes no pushes today/s)]);
	expect(w.state.engineUpdates.get("1.1.0")).toMatchObject({ outcome: "failed", base: sh(w.repo.remote, ["rev-parse", "main"]).trim() });
});

test("an install that changes a file beside package.json, the lockfile and the new engine's setup files pins nothing, and the card names the file", async () => {
	const { w, worker } = await pinnedWorld({ "1.1.0": upgradingCli("1.1.0") }, "1.1.0", { postinstall: "echo installed >> notes.txt" });

	expect(await tickAndSettle(worker)).toEqual({ kind: "ran", started: [] });
	expect(pinOnBase(w)).toBe(RUNNING);
	expect(engineCards(w).map(({ cause }) => cause)).toEqual(["Updating hum from 1.0.0 to 1.1.0 failed: it also changed notes.txt, which hum leaves to the owner"]);
});
