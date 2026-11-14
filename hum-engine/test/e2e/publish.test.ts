import { expect, test } from "bun:test";
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { docsJudge } from "../fixtures/judge.ts";
import { configWith } from "../fixtures/config.ts";
import { type PassOutbox, publishPass } from "../../src/publish/publisher.ts";
import { readOutbox, writeBaseCheck, writeOutboxState, writePass } from "../../src/publish/handover.ts";
import { publisherOf, runThinPath } from "../../src/worker/thin-path.ts";

import { sh } from "../fixtures/work-repo.ts";
import { tempDir } from "../fixtures/temp.ts";
import { type WorkerWorld, workerWorld } from "../fixtures/worker-world.ts";
import { ItemId } from "../../src/adapter-api.ts";
import type { HumConfig } from "../../src/config/schema.ts";
import { identityEnv } from "../../src/adapters/git.ts";
import { openState, PUBLISH_DIR } from "../../src/state/open.ts";
import { evidenceRef } from "../../src/worker/evidence.ts";
import { runBranch } from "../../src/worker/thin-path.ts";
import { publishWake } from "../../src/publish/wake.ts";
import type { Intent } from "../../src/publish/intents.ts";

const NOTE = { "docs/note.md": "hello\n" };

/** A pass that writes `files`, whose outbox is kept, not published, with the base it started on. `before` acts on the item before the pass, on the world's one clock. */
const workedPass = async ({ files = NOTE, before, settings }: { readonly files?: Readonly<Record<string, string>>; readonly before?: (w: WorkerWorld, id: ItemId) => Promise<void>; readonly settings?: Partial<HumConfig> } = {}) => {
	const w = await workerWorld({ script: [{}, { write: files }] }, { checks: [`test -f ${Object.keys(files)[0]}`], settings });
	const id = ItemId.parse(w.repo.seed("Write the note"));
	const now = () => w.clock.at;
	const baseSha = sh(w.repo.remote, ["rev-parse", "main"]).trim();
	const kept = tempDir("kept");
	let outbox: PassOutbox | undefined;

	await before?.(w, id);
	w.clock.at += 1;

	const worked = await runThinPath(
		w.thinPath({
			now,
			publish: async (pass) => {
				outbox = { ...pass, bundle: pass.bundle && join(kept, "pass.bundle") };

				if (pass.bundle) cpSync(pass.bundle, join(kept, "pass.bundle"));

				return undefined;
			},
		}),
	);

	if (outbox === undefined) throw new Error("the pass handed publish nothing");

	return { w, id, now, baseSha, worked, outbox };
};

test("publish starts no merge past its token's hour: the landing stays saved, and the next publish lands it without a run", async () => {
	const { w, id, baseSha, worked, outbox } = await workedPass();
	const before = sh(w.repo.remote, ["rev-parse", "main"]).trim();
	const runs = w.shim.calls().length;

	expect(worked).toMatchObject({ outcome: "held", why: "publish lands the change" });
	expect(await publishPass(publisherOf(w.thinPath(), docsJudge, 0), { baseSha, heads: {} }, outbox)).toMatchObject({ outcome: "held", why: expect.stringContaining("token's hour") });
	expect(sh(w.repo.remote, ["rev-parse", "main"]).trim()).toBe(before);
	expect(w.state.landings.get(id)).toBeDefined();
	expect(await publishPass(publisherOf(w.thinPath(), docsJudge), { baseSha, heads: {} }, outbox)).toEqual({ outcome: "merged", item: id });
	expect(w.shim.calls()).toHaveLength(runs);
});

const approvedEarlier = async (w: WorkerWorld, id: ItemId) => {
	await w.markdown.questions!.ask(id, { text: "Approve this change?" });
	await w.markdown.answers!.answer(id, { text: "approve", option: "approve" });
};

test.each([
	["docs/note.md at level high", NOTE],
	["adapters/evil.ts, a path only the owner changes", { "adapters/evil.ts": "export {};\n" }],
])("an approve answer given before publish saved the change approves none of it: %s", async (_, files) => {
	const high = configWith((raw) => void (raw.hum.paths = [{ glob: "docs/**", level: "high" }]));
	const { w, id, now, baseSha, outbox } = await workedPass({ files, before: approvedEarlier });
	const [file = ""] = Object.keys(files);
	const forged = { ...outbox, intents: outbox.intents.map((intent) => ({ ...intent, ownerApproved: true })) };

	expect(await publishPass(publisherOf(w.thinPath({ config: high, now }), docsJudge), { baseSha, heads: {} }, forged)).toMatchObject({ outcome: "review", item: id });
	expect(() => sh(w.repo.remote, ["show", `main:${file}`])).toThrow();
});

test("publish refuses an outbox over its size cap, or one that names an item gather did not claim, before it reads a pass, and reads the base check the work job ran", async () => {
	const folder = tempDir("outbox");

	writePass(folder, { item: "a", result: { outcome: "held", item: "a", why: "publish lands the change" }, intents: [], bundle: undefined });
	writeBaseCheck(folder, { items: ["merged"], failure: "the checks fail" });
	writeOutboxState(folder, tempDir("work-state"));
	writeFileSync(join(folder, "padding"), "x".repeat(2048));

	expect(() => readOutbox(folder, { maxBytes: 1024, claimed: new Set(["a"]) })).toThrow(/over the 1024 bytes/);
	expect(() => readOutbox(folder, { maxBytes: 1024 * 1024, claimed: new Set(["b"]) })).toThrow(/names a, which gather did not claim/);
	expect(readOutbox(folder, { maxBytes: 1024 * 1024, claimed: new Set(["a"]) })).toMatchObject({ passes: [{ item: "a" }], baseCheck: { items: ["merged"], failure: "the checks fail" } });
});

/** The remote's refs and every record of publish's state, which a refused pass leaves as they were. */
const snapshotOf = (w: WorkerWorld) => ({
	refs: sh(w.repo.remote, ["for-each-ref", "--format=%(refname) %(objectname)"]),
	state: Object.fromEntries(
		[...new Bun.Glob("**").scanSync({ cwd: w.state.dir, onlyFiles: true, dot: true })].filter((file) => !file.startsWith(`${PUBLISH_DIR}/`)).sort().map((file) => [file, readFileSync(join(w.state.dir, file), "utf8")]),
	),
});

/** A bundle of the item's run branch with one commit by `by`, grown from the remote's base. */
const forgedBundle = (w: WorkerWorld, id: ItemId, by: { readonly name: string; readonly email: string }) => {
	const clone = tempDir("forger");
	const branch = runBranch(w.config.hum, id);
	const file = join(tempDir("forged"), "pass.bundle");

	sh(clone, ["clone", "-q", w.repo.remote, "."]);
	sh(clone, ["checkout", "-q", "-b", branch]);
	writeFileSync(join(clone, "forged.txt"), "forged\n");
	sh(clone, ["add", "forged.txt"]);
	Bun.spawnSync(["git", "commit", "-q", "-m", "forged"], { cwd: clone, env: { ...process.env, ...identityEnv(by) } });
	sh(clone, ["bundle", "create", "-q", file, `refs/heads/${branch}`, "--not", "main"]);

	return { file, head: sh(clone, ["rev-parse", "HEAD"]).trim() };
};

const STRANGER = { name: "Stranger", email: "stranger@example.com" };

const refusals: readonly [string, (w: WorkerWorld, id: ItemId, outbox: PassOutbox) => PassOutbox, RegExp][] = [
	["a bundle commit by another identity", (w, id) => {
		const forged = forgedBundle(w, id, STRANGER);

		return { item: id, intents: [{ kind: "land", head: forged.head }], bundle: forged.file };
	}, /is by Stranger/],
	["a head neither its bundle's tip, the base nor its branch's head", (_, id, outbox) => ({ ...outbox, intents: [{ kind: "land", head: "0".repeat(40) }] }), /names 0{40} as the head/],
	["evidence its bundle does not hold", (_, id, outbox) => ({ ...outbox, intents: [{ kind: "keep-evidence" }, ...outbox.intents] }), new RegExp(`evidence its bundle does not hold on ${evidenceRef("seed-1")}`)],
	["more follow-ups than followUpsPerPass", (w, id, outbox) => ({ ...outbox, intents: [...Array.from({ length: w.config.hum.followUpsPerPass + 1 }, (): Intent => ({ kind: "file-follow-up", title: "More", body: "More." })), ...outbox.intents] }), /files 11 follow-ups/],
];

test.each(refusals)("publish refuses a pass that names %s, and leaves the remote's refs and its state as they were", async (_, forge, why) => {
	const { w, id, now, baseSha, outbox } = await workedPass();
	const before = snapshotOf(w);

	expect(await publishPass(publisherOf(w.thinPath({ now }), docsJudge), { baseSha, heads: {} }, forge(w, id, outbox))).toMatchObject({ outcome: "stuck", item: id, detail: expect.stringMatching(why) });
	expect(snapshotOf(w)).toEqual(before);
});

test("publish refuses a pass whose branch holds a tree over publishTreeMaxMegabytes before it checks it out, and leaves the remote's refs and its state as they were", async () => {
	const { w, id, now, baseSha, outbox } = await workedPass({ files: { "docs/big.md": "x".repeat(1024 * 1024 + 1) }, settings: { publishTreeMaxMegabytes: 1 } });
	const before = snapshotOf(w);

	expect(await publishPass(publisherOf(w.thinPath({ now }), docsJudge), { baseSha, heads: {} }, outbox)).toMatchObject({ outcome: "stuck", item: id, detail: expect.stringContaining("over publishTreeMaxMegabytes (1)") });
	expect(snapshotOf(w)).toEqual(before);
});

test("publish refuses a work job's move to the kind the item has, keeps the kind it holds and writes nothing to the remote; a pass that throws ends refused, and the state is saved after each pass", async () => {
	const { w, id, now, baseSha, outbox } = await workedPass();
	const other = ItemId.parse(w.repo.seed("Another"));
	const publisher = publisherOf(w.thinPath({ now }), docsJudge);
	const kind = { item: id, kind: "docs", from: "fallback", why: "no answer fits" } as const;
	let saves = 0;

	w.state.itemKinds.put(id, kind);
	w.state.itemKinds.put(other, { item: other, kind: "docs", from: "source" });
	const refs = snapshotOf(w).refs;

	const results = await publishWake({
		publisher: { ...publisher, workSource: { ...publisher.workSource, read: async (item) => (item === other ? Promise.reject(new Error("the work source broke")) : publisher.workSource.read(item)) } },
		gathered: { holder: w.thinPath().holder, base: "main", baseSha, heads: {}, claimed: [id, other] },
		outbox: { passes: [{ item: id, result: { outcome: "moved", item: id, kind: "docs" }, intents: [...outbox.intents], bundle: undefined }, { item: other, result: { outcome: "held", item: other, why: "publish lands the change" }, intents: [], bundle: undefined }], baseCheck: undefined, stateDir: tempDir("work-state"), bundleOf: () => outbox.bundle },
		work: openState(tempDir("work-state"), { now }),
		save: async () => void saves++,
	});

	expect(results).toMatchObject([
		{ outcome: "stuck", item: id, detail: expect.stringContaining("the kind it already has") },
		{ outcome: "stuck", item: other, detail: expect.stringContaining("the work source broke") },
	]);
	expect(w.state.itemKinds.get(id)).toEqual(kind);
	expect(snapshotOf(w).refs).toBe(refs);
	expect(saves).toBe(3);
});
