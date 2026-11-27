import { expect, test } from "bun:test";
import { handoffText } from "../src/adapters/handoff-pad.ts";

const REVIEWS = [
	{ label: "review #5", event: "request-changes", refused: "request-changes must cite a file and a line the diff changes", request: { status: "open", text: "Make README's gaps line match.", files: ["README.md"], untouched: ["README.md"] } },
	{ label: "review #6", event: "approve", request: { status: "unclear", text: "b is unused.", files: ["src/gaps/folder.ts"], changed: ["src/gaps/folder.ts"] } },
] as const;

const FACTS = { branch: "hum/run/140", files: [{ path: "src/gaps/folder.ts", added: 20, removed: 3 }, { path: "img.png" }], reviews: REVIEWS };

test("the handoff Pad puts what the owner decides first, then the open requests, the changed files, each review and where to look", () => {
	const rows = [
		{ label: "build #4", name: "hum 140 build #4" },
		{ label: "review #5", name: "hum 140 review #5" },
	];

	const rowLink = (name: string) => (name === "hum 140 build #4" ? "roundup://agent/7?project=p" : undefined);

	expect(handoffText({ id: "140", title: "Plant cited gaps", question: "Approve this change?", rowLink, handoff: { ...FACTS, rows, decide: { options: ["approve", "retry"], ownWords: false } } })).toBe(`**#140 Plant cited gaps: Approve this change?**

**Decide:** approve, or retry. Answer in the question's row.

## Open requests

- review #5: Make README's gaps line match. \`README.md\` is not on \`hum/run/140\`.

## Changed files (2, +20 -3)

- \`src/gaps/folder.ts\` +20 -3
- \`img.png\` binary

## Reviews

1. review #5: request-changes. hum set this answer aside and asked again: request-changes must cite a file and a line the diff changes.
2. review #6: approve.
   It asked: b is unused. hum cannot tell whether the commits after it settle that: they change \`src/gaps/folder.ts\`.

## Where to look

- The branch \`hum/run/140\`
- Rows: [build #4](roundup://agent/7?project=p)`);
});

test("once merged, the handoff Pad leads with the commit and keeps the open requests as follow-ups", () => {
	const text = handoffText({ id: "140", title: "Plant cited gaps", rowLink: () => undefined, handoff: { ...FACTS, rows: [], merged: { commit: "e44ac8e2d91363102ae8f752" } } });

	expect(text.split("\n\n").filter((block) => !block.startsWith("-") && !block.startsWith("1."))).toEqual(["**#140 Plant cited gaps: merged at `e44ac8e`.**", "## Open follow-ups", "## Changed files (2, +20 -3)", "## Reviews", "## Where to look"]);
	expect(text).toEndWith("- Merged at `e44ac8e`, from the branch `hum/run/140`");
});
