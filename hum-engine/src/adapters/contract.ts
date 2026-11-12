import assert from "node:assert/strict";
import { type Adapter, type Answers, ClaimResult, Item, ItemRef, type Questions, type Release, Watch, type WorkSource } from "../adapter-api.ts";
import type { ClaimMode } from "./claim.ts";

/**
 * What the contract suite needs from one provider. Reads hit the provider; writes go to a scratch
 * target the provider owns: a temp repo, a scratch Project, an in-memory fake.
 */
export type ContractTarget = {
	readonly name: string;
	readonly adapter: Adapter;
	/** A second worker on the same scratch target, for races. Defaults to `adapter`. */
	readonly other?: () => Promise<Adapter>;
	/** Puts a ready item on the scratch target and returns its id. */
	readonly seed: (title: string) => Promise<string>;
	/** Moves the provider's clock forward, so a claim expires. */
	readonly advance: (ms: number) => Promise<void>;
	/** Requests so far that spent rate limit. */
	readonly spent: () => number;
	/** Polls `until` while the provider catches up with a write; a provider whose reads lag its writes sets it. It throws if `until` never holds. */
	readonly settle?: (until: () => Promise<boolean>) => Promise<void>;
};

export type Check = { readonly name: string; readonly run: () => Promise<void> };

const TTL = 60_000;

const need = <T>(value: T | undefined, what: string): T => {
	assert.ok(value !== undefined, what);

	return value;
};

const workSourceChecks = (target: ContractTarget, source: WorkSource): Check[] => {
	const second = async () => (target.other ? target.other() : target.adapter);
	const readItem = async (id: string) => Item.parse(await source.read(id));
	const ready = async () => ItemRef.array().parse(await source.listReady());
	const isListed = async (id: string) => (await ready()).some((ref) => ref.id === id);

	const claimOf = async (who: Adapter, id: string, holder: string, mode: ClaimMode = "claim") =>
		ClaimResult.parse(await need(who.workSource, "no work source")[mode](id, holder, TTL));

	return [
		{
			name: "work source: a seeded item is listed ready and reads back",
			run: async () => {
				const id = await target.seed("seeded one");

				assert.ok((await ready()).some((ref) => ref.id === id && ref.title === "seeded one"));

				const item = await readItem(id);

				assert.equal(item.title, "seeded one");
				assert.equal(item.ready, true);
				assert.deepEqual(item.thread, []);
			},
		},
		{
			name: "work source: a comment lands on the thread",
			run: async () => {
				const id = await target.seed("commented");

				await source.comment(id, "first words");

				const { thread } = await readItem(id);

				assert.equal(thread.length, 1);
				assert.equal(thread[0]?.kind, "comment");
				assert.equal(thread[0]?.text, "first words");
			},
		},
		{
			name: "work source: two claims race and one wins",
			run: async () => {
				const id = await target.seed("raced");
				const results = await Promise.all([claimOf(target.adapter, id, "worker-a"), claimOf(await second(), id, "worker-b")]);
				const winners = results.filter((result) => result.won);

				assert.equal(winners.length, 1, "exactly one claim wins");

				for (const result of results) assert.equal(result.claim.holder, winners[0]?.claim.holder, "both calls name the winner");

				assert.ok(!(await isListed(id)), "a claimed item is no longer listed");
				assert.equal((await readItem(id)).ready, false);
			},
		},
		{
			name: "work source: the holder renews, another worker cannot",
			run: async () => {
				const id = await target.seed("renewed");

				assert.equal((await claimOf(target.adapter, id, "worker-a")).won, true);
				assert.equal((await claimOf(target.adapter, id, "worker-a")).won, true, "the holder claiming again renews");
				assert.equal((await claimOf(target.adapter, id, "worker-a", "renew")).won, true);
				assert.equal((await claimOf(target.adapter, id, "worker-b", "renew")).won, false);
				assert.equal((await claimOf(target.adapter, id, "worker-b")).won, false);
			},
		},
		{
			name: "work source: an expired claim is taken once",
			run: async () => {
				const id = await target.seed("expired");
				const b = await second();

				assert.equal((await claimOf(target.adapter, id, "worker-a")).won, true);
				await target.advance(TTL + 1);
				assert.ok(await isListed(id), "an expired claim lists the item again");

				const results = await Promise.all([claimOf(target.adapter, id, "worker-b"), claimOf(b, id, "worker-c")]);

				assert.equal(results.filter((result) => result.won).length, 1, "the expired claim is taken once");
				assert.equal((await claimOf(target.adapter, id, "worker-a", "renew")).won, false, "the old holder lost it");
			},
		},
		{
			name: "work source: a follow-up is listed ready, and filing it twice files it once",
			run: async () => {
				const from = await target.seed("parent");
				const first = ItemRef.parse(await source.fileFollowUp(from, { title: "Follow up A", body: "Do A." }));
				const again = ItemRef.parse(await source.fileFollowUp(from, { title: "Follow up A", body: "Do A." }));

				await target.settle?.(() => isListed(first.id));

				assert.equal(again.id, first.id);
				assert.equal((await ready()).filter((ref) => ref.id === first.id).length, 1);
				assert.equal((await readItem(first.id)).ready, true);
			},
		},
	];
};

const questionChecks = (target: ContractTarget, source: WorkSource, questions: Questions): Check[] => [
	{
		name: "questions: a question and a decision land on the thread",
		run: async () => {
			const id = await target.seed("asked");

			await questions.ask(id, { text: "Which way?", options: ["left", "right"] });
			await questions.decide(id, "went left");

			assert.deepEqual(
				Item.parse(await source.read(id)).thread.map((entry) => entry.kind),
				["question", "decision"],
			);
		},
	},
];

const answerChecks = (target: ContractTarget, source: WorkSource, answers: Answers): Check[] => [
	{
		name: "answers: an answer lands on the thread with its option",
		run: async () => {
			const id = await target.seed("answered");

			await answers.answer(id, { text: "go ahead", option: "approve" });

			const [entry] = Item.parse(await source.read(id)).thread;

			assert.equal(entry?.kind, "answer");
			assert.equal(entry?.text, "go ahead");
			assert.equal(entry?.option, "approve");
		},
	},
	{
		name: "answers: an idle watch costs nothing and a write flips it",
		run: async () => {
			const id = await target.seed("watched");
			const first = Watch.parse(await answers.watch());
			const spent = target.spent();
			const idle = Watch.parse(await answers.watch(first.token));

			assert.equal(idle.changed, false, "nothing wrote, so nothing changed");
			assert.equal(idle.token, first.token);
			assert.equal(target.spent(), spent, "an idle watch spends no rate limit");

			await answers.answer(id, { text: "flip" });
			await target.settle?.(async () => (await answers.watch(first.token)).changed);

			const flipped = Watch.parse(await answers.watch(first.token));

			assert.equal(flipped.changed, true);
			assert.notEqual(flipped.token, first.token);
		},
	},
];

const releaseChecks = (target: ContractTarget, release: Release): Check[] => [
	{
		name: "release: publish and release accept an item",
		run: async () => {
			const id = await target.seed("shipped");

			await release.publish(id, "branch-x");
			await release.release(id, "branch-x");
		},
	},
];

/** The checks every adapter runs for the integrations it provides. */
export const contractChecks = (target: ContractTarget): Check[] => {
	const { questions, answers, release } = target.adapter;
	const source = need(target.adapter.workSource, `${target.name} provides no work source`);

	return [
		...workSourceChecks(target, source),
		...(questions ? questionChecks(target, source, questions) : []),
		...(answers ? answerChecks(target, source, answers) : []),
		...(release ? releaseChecks(target, release) : []),
	];
};

export type ContractResult = { readonly name: string; readonly failure?: string };

const runCheck = async ({ name, run }: Check): Promise<ContractResult> => {
	try {
		await run();

		return { name };
	} catch (error) {
		return { name, failure: error instanceof Error ? error.message : String(error) };
	}
};

/** Runs every check one after another and returns each result; nothing stops at the first failure. */
export const runContract = async (target: ContractTarget): Promise<ContractResult[]> => {
	const results: ContractResult[] = [];

	for (const check of contractChecks(target)) results.push(await runCheck(check));

	return results;
};
