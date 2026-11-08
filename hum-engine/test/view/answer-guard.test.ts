import { expect, test } from "bun:test";
import { guardAnswer } from "../../../hum/mod/answer/guard.ts";

type Reached = { readonly reached: "claude" } | { readonly dropped: string };

const harness = (isAnswering: boolean) => {
	const shown: string[] = [];

	const steps = {
		isAnswering: async () => isAnswering,
		decide: async (): Promise<never> => {
			throw new Error("the status file vanished");
		},
		pass: async (): Promise<Reached> => ({ reached: "claude" }),
		drop: (reason: string): Reached => ({ dropped: reason }),
		show: (message: string) => void shown.push(message),
	};

	return { shown, run: () => guardAnswer(steps) };
};

test("a failure in answer mode drops only that answer and shows the error once, as the drop's reason", async () => {
	const h = harness(true);

	expect(await h.run()).toEqual({ dropped: "hum: the status file vanished" });
	expect(h.shown).toEqual([]);
});

test("a failure on any other prompt lets it reach Claude and shows the error once", async () => {
	const h = harness(false);

	expect(await h.run()).toEqual({ reached: "claude" });
	expect(h.shown).toEqual(["hum: the status file vanished"]);
});
