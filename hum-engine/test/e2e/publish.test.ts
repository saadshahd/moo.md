import { expect, test } from "bun:test";
import { cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { docsJudge } from "../fixtures/judge.ts";
import { configWith } from "../fixtures/config.ts";
import { type PassOutbox, publishPass } from "../../src/publish/publisher.ts";
import { readOutbox, writeOutboxState, writePass } from "../../src/publish/handover.ts";
import { publisherOf, runThinPath } from "../../src/worker/thin-path.ts";
import { sh } from "../fixtures/work-repo.ts";
import { tempDir } from "../fixtures/temp.ts";
import { workerWorld } from "../fixtures/worker-world.ts";

const NOTE = { write: { "docs/note.md": "hello\n" } };

/** A pass whose outbox is kept, not published, with the base it started on. */
const workedPass = async () => {
	const w = await workerWorld({ script: [{}, NOTE] }, { checks: ["test -f docs/note.md"] });
	const id = w.repo.seed("Write the note");
	const baseSha = sh(w.repo.remote, ["rev-parse", "main"]).trim();
	const kept = tempDir("kept");
	let outbox: PassOutbox | undefined;

	const worked = await runThinPath(
		w.thinPath({
			publish: async (pass) => {
				outbox = { ...pass, bundle: pass.bundle && join(kept, "pass.bundle") };

				if (pass.bundle) cpSync(pass.bundle, join(kept, "pass.bundle"));

				return undefined;
			},
		}),
	);

	if (outbox === undefined) throw new Error("the pass handed publish nothing");

	return { w, id, baseSha, worked, outbox };
};

test("publish starts no merge past its token's hour: the landing stays saved, and the next publish lands it without a run", async () => {
	const { w, id, baseSha, worked, outbox } = await workedPass();
	const before = sh(w.repo.remote, ["rev-parse", "main"]).trim();
	const runs = w.shim.calls().length;

	expect(worked).toMatchObject({ outcome: "held", why: "publish lands the change" });
	expect(await publishPass(publisherOf(w.thinPath(), docsJudge, 0), { baseSha, heads: [] }, outbox)).toMatchObject({ outcome: "held", why: expect.stringContaining("token's hour") });
	expect(sh(w.repo.remote, ["rev-parse", "main"]).trim()).toBe(before);
	expect(w.state.landings.get(id)).toBeDefined();
	expect(await publishPass(publisherOf(w.thinPath(), docsJudge), { baseSha, heads: [] }, outbox)).toEqual({ outcome: "merged", item: id });
	expect(w.shim.calls()).toHaveLength(runs);
});

test("publish takes the owner's approval from the thread, never from the work job's word", async () => {
	const { w, id, baseSha, outbox } = await workedPass();
	const high = configWith((raw) => void (raw.hum.paths = [{ glob: "docs/**", level: "high" }]));
	const forged = { ...outbox, intents: outbox.intents.map((intent) => (intent.kind === "land" ? { ...intent, ownerApproved: true } : intent)) };

	expect(await publishPass(publisherOf(w.thinPath({ config: high }), docsJudge), { baseSha, heads: [] }, forged)).toMatchObject({ outcome: "review", item: id });
	expect(() => sh(w.repo.remote, ["show", "main:docs/note.md"])).toThrow();
});

test("publish refuses an outbox over its size cap, or one that names an item gather did not claim, before it reads a pass", async () => {
	const folder = tempDir("outbox");

	writePass(folder, { item: "a", result: { outcome: "held", item: "a", why: "publish lands the change" }, intents: [], bundle: undefined });
	writeOutboxState(folder, tempDir("work-state"));
	writeFileSync(join(folder, "padding"), "x".repeat(2048));

	expect(() => readOutbox(folder, { maxBytes: 1024, claimed: new Set(["a"]) })).toThrow(/over the 1024 bytes/);
	expect(() => readOutbox(folder, { maxBytes: 1024 * 1024, claimed: new Set(["b"]) })).toThrow(/names a, which gather did not claim/);
	expect(readOutbox(folder, { maxBytes: 1024 * 1024, claimed: new Set(["a"]) }).passes).toHaveLength(1);
});
