import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { Holder, ItemId } from "../../src/adapter-api.ts";
import { runContract } from "../../src/adapters/contract.ts";
import { railTree, rootWorkstream } from "../../src/adapters/rail.ts";
import { roundupAdapter } from "../../src/adapters/roundup.ts";
import { roundupRpc } from "../../src/adapters/roundup-rpc.ts";
import { SHIPPED_DEFAULTS } from "../../src/config/schema.ts";

/**
 * The rig's program for hum's items: the roundup adapter, as the Project's program, which alone may start a question
 * row, runs one scenario and writes its result where the test reads it. It then waits, since roundup starts a
 * program that exits again.
 */
const [scenario = "", rig = ""] = process.argv.slice(2);

const socket = process.env.RUPD_SOCKET ?? "";

const clock = { offset: 0 };

const now = (): number => Date.now() + clock.offset;

const ANSWER_WAIT_MS = 60_000;

const adapterOn = (state: string) => roundupAdapter({ socket, workstream: SHIPPED_DEFAULTS.roundupWorkstream, stateDir: join(rig, state), repo: join(rig, "repo"), config: SHIPPED_DEFAULTS }, { report: () => {}, now, env: process.env });

/** Asks the question item's question as a row, and reads its thread until an answer is on it. */
const question = async (): Promise<object> => {
	const adapter = adapterOn("state-question");
	const item = (await adapter.workSource.listReady()).find(({ title }) => title === "question item");

	if (!item) return { error: "no ready Todo named question item" };

	await adapter.workSource.claim(item.id, Holder.parse("rig"), ANSWER_WAIT_MS);
	writeFileSync(join(rig, `go-ask-${item.id}`), "");
	await adapter.questions.ask(item.id, { text: "Which title?", options: ["a", "b"] });

	const refusal = await adapter.answers.answer(item.id, { text: "through hum" }).then(
		() => undefined,
		(error: Error) => error.message,
	);

	for (const deadline = Date.now() + ANSWER_WAIT_MS; ; await Bun.sleep(200)) {
		const { thread } = await adapter.workSource.read(item.id);

		if (thread.some(({ kind }) => kind === "answer") || Date.now() > deadline) return { thread, refusal };
	}
};

/** Every check of the adapter contract, with items seeded in the hum Workstream. */
const contract = async (): Promise<object> => {
	const seeder = roundupRpc(socket);
	const hum = rootWorkstream(await railTree(seeder.call), SHIPPED_DEFAULTS.roundupWorkstream)?.id;

	if (!hum) return { error: "no hum Workstream" };

	const seed = async (title: string) => {
		const { id } = z.looseObject({ id: z.int() }).parse(await seeder.call("todo.create", { title }));

		await seeder.call("todo.move", { id, home: hum });

		return ItemId.parse(String(id));
	};

	const [primary, secondary] = [adapterOn("state-contract"), adapterOn("state-contract")];
	/* The owner answers only in a question's row, so the contract's checks of an answer written through hum do not apply; the rig's wake case covers the watch. */
	const results = await runContract({ name: "roundup (rig)", adapter: { ...primary, answers: undefined }, other: async () => secondary, seed, advance: async (ms) => void (clock.offset += ms), spent: primary.spent });

	return { results };
};

const SCENARIOS = new Map(Object.entries({ question, contract }));

const result = JSON.stringify(await (SCENARIOS.get(scenario) ?? (async () => ({ error: `no scenario ${scenario}` })))().catch((error: Error) => ({ error: error.stack ?? error.message })));

writeFileSync(join(rig, `result-${scenario}.json`), result);

setInterval(() => {}, 1 << 30);
