import { afterEach, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openState } from "../src/state/open.ts";
import { HOUR_MS } from "../src/time.ts";
import { queueQuestion, releaseQuestions } from "../src/worker/questions.ts";
import { workerWorld, type WorkerWorld } from "./fixtures/worker-world.ts";
import { itemFile, sh } from "./fixtures/work-repo.ts";

const worlds: WorkerWorld[] = [];

const world = async (...args: Parameters<typeof workerWorld>) => {
	const made = await workerWorld(...args);

	worlds.push(made);

	return made;
};

afterEach(() => {
	for (const made of worlds.splice(0)) made.clean();
});

const threadOf = async (w: WorkerWorld, id: string) => (await w.adapter.workSource!.read(id)).thread;

const questionsOn = async (w: WorkerWorld, id: string) => (await threadOf(w, id)).filter((entry) => entry.kind === "question");

const repliesOn = async (w: WorkerWorld, id: string) => (await threadOf(w, id)).filter((entry) => /^Answer \d+ /.test(entry.text)).map((entry) => entry.text);

test("with 50 items ready and a cap of 3, three are asked and the rest wait for room; a day later the next three are", async () => {
	const ids = Array.from({ length: 50 }, (_, n) => `q-${String(n).padStart(2, "0")}`);
	const w = await world({}, { settings: { dailyQuestionCap: 3 } });

	for (const id of ids) w.ownerFile(`.hum/work/${id}.md`, itemFile(id));

	w.repo.commit("seed fifty");
	sh(w.repo.owner, ["push", "-q", "origin", "main"]);

	const ctx = { state: w.state, config: w.config, workSource: w.adapter.workSource!, questions: w.adapter.questions!, now: () => w.clock.at };

	for (const id of ids) queueQuestion(ctx, await w.adapter.workSource!.read(id), { text: "Which title?" }, "unsure");

	const asked = async () => (await Promise.all(ids.map(async (id) => ((await questionsOn(w, id)).length > 0 ? [id] : [])))).flat();

	expect(await releaseQuestions(ctx)).toHaveLength(3);
	expect(await releaseQuestions(ctx)).toEqual([]);
	expect(await asked()).toHaveLength(3);

	w.clock.at += 25 * HOUR_MS;
	expect(await releaseQuestions(ctx)).toHaveLength(3);
	expect(await asked()).toHaveLength(6);
});

test("every answer is saved first and gets a reply: applied, then a second answer to the same question dropped with its reason", async () => {
	const w = await world({ items: { a: { commitForItem: true, askUnlessAnswered: "Which?" } } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked" });

	await w.adapter.answers!.answer("a", { text: "Use Plain" });
	await w.adapter.answers!.answer("a", { text: "No, Use Short" });
	w.clock.at += 2 * HOUR_MS;
	await w.worker.tick();
	await w.worker.idle();

	const replies = await repliesOn(w, "a");

	expect(replies).toHaveLength(2);
	expect(replies[0]).toStartWith("Answer 1 applied:");
	expect(replies[1]).toStartWith("Answer 2 dropped:");
	expect(replies[1]).toContain("already has an answer");
	expect(w.state.answers.list().map(({ ordinal, disposition }) => [ordinal, disposition]).sort()).toEqual([[1, "applied"], [2, "dropped"]]);

	await w.worker.tick();
	await w.worker.idle();
	expect(await repliesOn(w, "a")).toEqual(replies);
});

test("an answer two hours after the question starts a fresh run on the pushed branch, with no session resumed", async () => {
	const w = await world({ items: { a: { commitForItem: true, askUnlessAnswered: "Which?" } } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked" });

	await w.adapter.answers!.answer("a", { text: "Use Plain" });
	w.clock.at += 2 * HOUR_MS;
	await w.worker.tick();
	await w.worker.idle();

	expect(w.results.at(-1)).toMatchObject({ outcome: "merged", item: "a" });
	expect(w.shim.calls().flatMap((call) => call.argv)).not.toContain("--resume");
});

test("a CI run with an empty state reads the question's age from the thread: it waits inside the deadline and parks stuck past it, asking nothing twice", async () => {
	const w = await world({ items: { a: { commitForItem: true, askUnlessAnswered: "Which?" } } });

	w.item("a", "docs/a.md");
	await w.worker.tick();
	await w.worker.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "asked" });

	const fresh = () => w.workerWith({ state: openState(mkdtempSync(join(tmpdir(), "hum-ci-")), { now: () => w.clock.at }) });

	w.clock.at += 2 * HOUR_MS;

	const waiting = fresh();

	await waiting.tick();
	await waiting.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "waiting", item: "a" });
	expect(await questionsOn(w, "a")).toHaveLength(1);

	w.clock.at += 25 * HOUR_MS;

	const late = fresh();

	await late.tick();
	await late.idle();
	expect(w.results.at(-1)).toMatchObject({ outcome: "stuck", item: "a" });
	expect(await questionsOn(w, "a")).toHaveLength(1);
});
