import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { bandRow } from "../../../hum/mod/view/band.ts";
import { rowCells } from "../../../hum/mod/view/cells.ts";
import { paneRows } from "../../../hum/mod/view/pane.ts";
import { parseStatus } from "../../../hum/mod/view/read.ts";
import type { Row } from "../../../hum/mod/view/row.ts";
import { workerWorld, type WorkerWorld } from "../fixtures/worker-world.ts";

const worlds: WorkerWorld[] = [];

afterEach(() => {
	for (const w of worlds.splice(0)) w.clean();
});

const WIDTHS = [20, 33, 45, 53, 80, 120, 200];
const AMBER_AFTER = 15;
const FORBIDDEN = /(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])\b[0-9a-f]{7,40}\b|sample|\(example\)|TODO/i;
const VIEW_SOURCES = join(import.meta.dir, "..", "..", "..", "hum", "mod");

const textOf = (row: Row): string => row.map(({ text }) => text).join("");

/** A status file the engine wrote while it merged one item, asked about another, held a third in flight and raised a fault. */
const realStatus = async () => {
	const w = await workerWorld({ items: { a: { commitForItem: true, spend: 5 }, b: { commitForItem: true, askUnlessAnswered: "Which title should it carry?" }, c: { commitForItem: true, spend: 5, sleep: 300 } } });

	worlds.push(w);
	w.item("a", "docs/a.md");
	w.item("b", "docs/b.md");
	w.state.faults.raise({ code: "run-error", item: "z", cause: "The run for z failed: the checks still fail.", fix: "hum tries the item again when its claim lapses." });
	w.state.choices.put("c@choice", { item: "c", text: 'Chose "short" over long without you.', at: w.clock.at });
	await w.worker.tick();
	await w.worker.idle();
	await w.worker.tick();

	return { path: w.state.statusPath, now: w.clock.at };
};

test("the view reads the status file the engine wrote, and every section draws inside every width", async () => {
	const { path, now } = await realStatus();
	const read = parseStatus(readFileSync(path, "utf8"));

	expect(read.kind).toBe("status");

	if (read.kind !== "status") return;

	expect(read.status.merged.map(({ item }) => item)).toContain("a");
	expect(read.status.questions.map(({ item }) => item)).toContain("b");
	expect(read.status.cards.map(({ code }) => code)).toContain("run-error");
	expect(read.status.choices).toHaveLength(1);

	for (const width of WIDTHS) {
		const rows = [...paneRows({ read, now, amberAfterSeconds: AMBER_AFTER, width, unfolded: new Set() }), bandRow({ read, now, amberAfterSeconds: AMBER_AFTER, width })];

		for (const row of rows) {
			expect(rowCells(row), `${textOf(row)} at ${width}`).toBeLessThanOrEqual(width);
			expect(textOf(row), `a word the view never shows, at ${width}`).not.toMatch(FORBIDDEN);
		}
	}
});

test("the mod ships nothing from the fixture folder", () => {
	const shipped = [...new Bun.Glob("**/*.{ts,tsx}").scanSync(VIEW_SOURCES)].filter((file) => !file.includes(".test.") && !file.startsWith("vendor/"));

	expect(shipped.length).toBeGreaterThan(5);

	for (const file of shipped) expect(readFileSync(join(VIEW_SOURCES, file), "utf8"), file).not.toMatch(/fixtures\//);
});
