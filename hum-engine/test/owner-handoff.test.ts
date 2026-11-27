import { expect, test } from "bun:test";
import type { z } from "zod";
import type { Finished } from "../src/adapters/claude-p.ts";
import type { EventPick } from "../src/decide/prose.ts";
import { openState } from "../src/state/open.ts";
import type { Landing } from "../src/state/saved.ts";
import { keepReview, waitingHandoff } from "../src/worker/owner-handoff.ts";
import { configWith } from "./fixtures/config.ts";
import { tempDir } from "./fixtures/temp.ts";

const answered = (structured: z.input<typeof EventPick>): Finished => ({ kind: "finished", subtype: "success", isError: false, sessionId: undefined, text: "", structured, tokens: 0, cacheReadTokens: 0, plugins: [], keySource: undefined, models: [] });

/** The diff the reviews read: it changes src/gaps/folder.ts and never README.md. */
const DIFF = `diff --git a/src/gaps/folder.ts b/src/gaps/folder.ts
--- a/src/gaps/folder.ts
+++ b/src/gaps/folder.ts
@@ -1,1 +1,2 @@
 const a = 1;
+const b = 2;
`;

const landingAt = (head: string, changedSince: Record<string, string[]>): Landing => ({
	item: "140",
	branch: "hum/run/140",
	since: 0,
	head,
	lostRaces: 0,
	change: { paths: ["src/gaps/folder.ts"], size: 1, loosened: false, pinChanged: false },
	files: [{ path: "src/gaps/folder.ts", added: 1, removed: 0 }],
	changedSince,
});

const reviewAs = (attempt: number) => ({ itemId: "140", run: "review", attempt });

test("a review's request whose files no later commit changed stays open, though hum set the answer aside and a later review approved, as on item 140", () => {
	const state = openState(tempDir("handoff"), { now: () => 0 });
	const readme = { event: "request-changes", sure: true, reason: "README.md:14 still counts two gaps.", cites: [{ file: "README.md", line: 14 }], plan: { summary: "Make README's gaps line match.", steps: ["Rewrite it."], paths: ["README.md"] } };

	keepReview(state, { item: "140", head: "h5", diff: DIFF, run: reviewAs(5), outcome: answered(readme), at: 5 });
	keepReview(state, { item: "140", head: "h6", diff: DIFF, run: reviewAs(6), outcome: answered({ event: "approve", sure: true, reason: "Fine." }), at: 6 });
	state.landings.put("140", landingAt("h6", { h5: ["src/gaps/folder.ts"] }));

	expect(waitingHandoff(state, configWith(), "140", ["approve", "retry"])?.reviews).toEqual([
		{ label: "review #5", row: "hum 140 review #5", event: "request-changes", refused: "request-changes must cite a file and a line the diff changes", request: { status: "open", text: "Make README's gaps line match.", files: ["README.md"], untouched: ["README.md"] } },
		{ label: "review #6", row: "hum 140 review #6", event: "approve" },
	]);
});

test("a review's request whose files a later commit changed is unclear and names them, and one whose head git could not read names none", () => {
	const state = openState(tempDir("handoff"), { now: () => 0 });
	const folder = { event: "request-changes", sure: true, reason: "b is unused.", cites: [{ file: "src/gaps/folder.ts", line: 2 }] };

	keepReview(state, { item: "140", head: "h1", diff: DIFF, run: reviewAs(1), outcome: answered(folder), at: 1 });
	keepReview(state, { item: "140", head: "h2", diff: DIFF, run: reviewAs(2), outcome: answered(folder), at: 2 });
	state.landings.put("140", landingAt("h3", { h1: ["src/gaps/folder.ts"] }));

	expect(waitingHandoff(state, configWith(), "140")?.reviews.map(({ request }) => request)).toEqual([
		{ status: "unclear", text: "b is unused.", files: ["src/gaps/folder.ts"], changed: ["src/gaps/folder.ts"] },
		{ status: "unclear", text: "b is unused.", files: ["src/gaps/folder.ts"] },
	]);
});
