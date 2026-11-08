import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
	type AdapterContext,
	type Adapter,
	admit,
	ADAPTER_API_VERSION,
	contractChecks,
	engineImporters,
	FakeProvider,
	type FaultInput,
	guarded,
	markdownAdapter,
	openState,
	PushRefused,
	sourceFiles,
	type State,
} from "../src/index.ts";
import { WorkRepo, itemFile, markdownSettings, sh } from "./fixtures/work-repo.ts";

const cleanups: (() => void)[] = [];

const tmp = (): string => {
	const dir = mkdtempSync(join(tmpdir(), "hum-adapter-"));

	cleanups.push(() => rmSync(dir, { recursive: true, force: true }));

	return dir;
};

afterEach(() => {
	for (const clean of cleanups.splice(0)) clean();
});

const stateIn = (now: () => number): State => openState(tmp(), { now });

describe("contract suite on markdown (a temp repo with a local bare remote)", () => {
	const repo = new WorkRepo();
	const clock = { offset: 0 };
	const now = () => Date.now() + clock.offset;
	const context: AdapterContext = { report: () => {}, now };
	const options = (path: string) => ({ repo: path, base: "main", ...markdownSettings });
	const primary = markdownAdapter(options(repo.worker("worker-1")), context);
	const secondary = markdownAdapter(options(repo.worker("worker-2")), context);

	const target = {
		name: "markdown",
		adapter: primary,
		other: async () => secondary,
		seed: async (title: string) => repo.seed(title),
		advance: async (ms: number) => void (clock.offset += ms),
		spent: () => primary.spent(),
	};

	for (const check of contractChecks(target)) test(check.name, check.run, 30_000);
});

describe("a malformed item file", () => {
	test("other items advance, and one card names the file", async () => {
		const repo = new WorkRepo();
		const reported: FaultInput[] = [];
		const adapter = markdownAdapter({ repo: repo.worker("w"), base: "main", ...markdownSettings }, { report: (fault) => void reported.push(fault), now: Date.now });

		repo.add("good", itemFile("Good one"));
		repo.add("broken", "no front matter at all\n");
		repo.add("bad-marker", `${itemFile("Bad marker")}\n<!-- hum {not json} -->\ntext\n`);

		const ready = await adapter.workSource?.listReady();

		expect(ready?.map((ref) => ref.id)).toEqual(["good"]);
		expect(reported.map((fault) => fault.item).sort()).toEqual(["bad-marker", "broken"]);
		expect(reported[0]?.cause).toContain(".hum/work/");
	});
});

describe("provider failures and empty lists", () => {
	const guardWith = (provider: FakeProvider, state: State, timeoutMs = 10_000) => guarded(provider.adapter(), { provider: "fake", faults: state.faults, timeoutMs });

	test("502 twice then OK shows nothing", async () => {
		const provider = new FakeProvider();
		const state = stateIn(provider.now);

		provider.seed("one");
		provider.failNext(2);

		expect((await guardWith(provider, state).workSource?.listReady())?.length).toBe(1);
		expect(state.faults.list()).toEqual([]);
	});

	test("502 past the timeout shows one card, however often it is read", async () => {
		const provider = new FakeProvider();
		const state = stateIn(provider.now);
		const adapter = guardWith(provider, state, 300);

		provider.failNext(10_000);

		await expect(adapter.workSource?.listReady()).rejects.toThrow("502");
		await expect(adapter.workSource?.listReady()).rejects.toThrow("502");
		expect(state.faults.list().map((card) => card.code)).toEqual(["provider-unavailable"]);

		provider.failNext(0);
		await adapter.workSource?.listReady();
		expect(state.faults.list()).toEqual([]);
	});

	test("[] after N items is a fault and marks nothing gone", async () => {
		const provider = new FakeProvider();
		const state = stateIn(provider.now);
		const adapter = guardWith(provider, state);

		provider.seed("a");
		provider.seed("b");
		expect((await adapter.workSource?.listReady())?.length).toBe(2);

		provider.emptyList = true;
		await expect(adapter.workSource?.listReady()).rejects.toThrow("contradicts");
		expect(state.faults.list().map((card) => card.code)).toEqual(["empty-list"]);

		provider.emptyList = false;
		expect((await adapter.workSource?.listReady())?.length).toBe(2);
		expect(state.faults.list()).toEqual([]);
	});

	test("[] is no work when every earlier item was claimed", async () => {
		const provider = new FakeProvider();
		const state = stateIn(provider.now);
		const adapter = guardWith(provider, state);
		const id = provider.seed("a");

		await adapter.workSource?.listReady();
		await adapter.workSource?.claim(id, "w", 60_000);

		expect(await adapter.workSource?.listReady()).toEqual([]);
		expect(state.faults.list()).toEqual([]);
	});
});

describe("the start check", () => {
	const guard = () => ({ timeoutMs: 1_000 });

	test("a reply whose shape changed is refused with one card, and the rest runs", async () => {
		const drifted = new FakeProvider();
		const fine = new FakeProvider();
		const state = stateIn(drifted.now);

		drifted.seed("a");
		drifted.listReplacement = () => JSON.parse('[{"identifier":"x","name":"drifted"}]');
		fine.seed("b");

		const refused = await admit({ name: "drifted", adapter: drifted.adapter(), faults: state.faults, guard: guard() });
		const kept = await admit({ name: "fine", adapter: fine.adapter(), faults: state.faults, guard: guard() });

		expect(refused.ok).toBe(false);
		expect(kept.ok).toBe(true);
		expect(state.faults.list().map((card) => card.key)).toEqual(["integration-shape-changed:drifted"]);
	});

	test("an adapter written for another API version is refused with one card", async () => {
		const provider = new FakeProvider();
		const state = stateIn(provider.now);
		const old: Adapter = { ...provider.adapter(), apiVersion: ADAPTER_API_VERSION - 1 };

		const refused = await admit({ name: "old", adapter: old, faults: state.faults, guard: guard() });
		const again = await admit({ name: "old", adapter: old, faults: state.faults, guard: guard() });

		expect(refused.ok).toBe(false);
		expect(again.ok).toBe(false);
		expect(state.faults.list().map((card) => card.key)).toEqual(["adapter-api-mismatch:old"]);
		expect(state.faults.list()[0]?.cause).toContain(`API ${ADAPTER_API_VERSION - 1}`);
	});

	test("an adapter that imports xstate is refused, and the card names the file", async () => {
		const provider = new FakeProvider();
		const state = stateIn(provider.now);
		const dir = tmp();
		const bad = join(dir, "adapters", "linear.ts");
		const good = join(dir, "adapters", "clean.ts");

		mkdirSync(dirname(bad), { recursive: true });
		writeFileSync(bad, `import { createMachine } from "xstate";\nexport default () => createMachine;\n`);
		writeFileSync(good, `import { ItemId } from "@moo.md/hum/adapter-api";\nexport default () => ItemId;\n`);

		const refused = await admit({ name: "linear", adapter: provider.adapter(), files: sourceFiles(join(dir, "adapters")), root: dir, faults: state.faults, guard: guard() });

		expect(refused.ok).toBe(false);
		expect(state.faults.list().map((card) => card.item)).toEqual(["adapters/linear.ts"]);
		expect(engineImporters([good])).toEqual([]);

		for (const line of [`import("xstate/graph")`, `require("@statelyai/agent")`, `import "xstate"`, `export * from "xstate"`]) {
			writeFileSync(bad, `${line};\n`);
			expect(engineImporters([bad]).length).toBe(1);
		}
	});

	test("the engine's own adapters import no engine module", () => {
		const here = dirname(import.meta.dir);

		expect(engineImporters([...sourceFiles(join(here, "src", "adapters")), join(here, "src", "adapter-api.ts")])).toEqual([]);
	});
});

describe("an answer writes, commits and pushes with hooks off", () => {
	const hook = (dir: string, name: string, script: string) => {
		const path = join(dir, "hooks", name);

		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, `#!/bin/sh\n${script}\n`);
		chmodSync(path, 0o755);
	};

	test("the answer lands on the remote's main, and no hook of the clone runs", async () => {
		const repo = new WorkRepo();
		const worker = repo.worker("w");
		const ran = join(repo.root, "hook-ran");

		for (const name of ["pre-push", "pre-commit", "commit-msg", "reference-transaction"]) hook(join(worker, ".git"), name, `touch ${ran}; exit 1`);

		const id = repo.seed("asked");
		const adapter = markdownAdapter({ repo: worker, base: "main", ...markdownSettings }, { report: () => {}, now: Date.now });

		await adapter.answers?.answer(id, { text: "ship it", option: "approve" });

		expect(repo.show(id)).toContain("ship it");
		expect(repo.show(id)).toContain('"option":"approve"');
		expect(existsSync(ran)).toBe(false);
	});

	test("a protected branch refuses the push, loudly", async () => {
		const repo = new WorkRepo();
		const reported: FaultInput[] = [];
		const id = repo.seed("asked");

		hook(repo.remote, "pre-receive", `echo "GH006: Protected branch update failed for refs/heads/main" >&2; exit 1`);

		const adapter = markdownAdapter({ repo: repo.worker("w"), base: "main", ...markdownSettings }, { report: (fault) => void reported.push(fault), now: Date.now });

		await expect(adapter.answers?.answer(id, { text: "no" })).rejects.toBeInstanceOf(PushRefused);
		await expect(adapter.answers?.answer(id, { text: "no" })).rejects.toThrow("Protected branch");
		expect(reported[0]?.code).toBe("push-refused");
		expect(repo.show(id)).not.toContain('"kind":"answer"');
		expect(sh(repo.remote, ["rev-parse", "main"]).length).toBeGreaterThan(0);
	});
});
