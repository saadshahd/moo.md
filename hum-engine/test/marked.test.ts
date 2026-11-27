import { expect, test } from "bun:test";
import { questionOf, questionText } from "../src/adapters/marked.ts";

test.each([
	["a question alone", { text: "Which title?" }],
	["with options and a detail", { text: "#140 is ready to merge: approve?", options: ["approve", "retry"], detail: "Review the branch.\n\nThen approve it." }],
])("a question read back from the text the thread shows is the question: %s", (_name, question) => {
	expect(questionOf(questionText(question))).toEqual(question);
});
