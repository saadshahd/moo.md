import assert from "node:assert/strict";
import { type Adapter, Item, ItemRef, ClaimResult, Watch } from "../adapter-api.ts";

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
	/** Polls `until` while the provider catches up with a write. A provider that lags, like GitHub's cache, sets it; it throws if `until` never holds. */
	readonly settle?: (until: () => Promise<boolean>) => Promise<void>;
};

export type Check = { readonly name: string; readonly run: () => Promise<void> };

const TTL = 60_000;

const need = <T>(value: T | undefined, what: string): T => {
	assert.ok(value !== undefined, what);

	return value;
};

/** The checks every adapter runs for the integrations it provides. */
export const contractChecks = (target: ContractTarget): Check[] => {
	const { adapter } = target;
	const source = need(adapter.workSource, `${target.name} provides no work source`);
	const second = async () => (target.other ? target.other() : adapter);
	const checks: Check[] = [];
	const add = (name: string, run: () => Promise<void>) => checks.push({ name, run });

	const readItem = async (id: string) => Item.parse(await source.read(id));
	const ready = async () => ItemRef.array().parse(await source.listReady());

	const claimOf = async (who: Adapter, id: string, holder: string, take: "claim" | "renew" = "claim") => {
		const ws = need(who.workSource, "no work source");

		return ClaimResult.parse(await ws[take](id, holder, TTL));
	};

	add("work source: a seeded item is listed ready and reads back", async () => {
		const id = await target.seed("seeded one");

		assert.ok((await ready()).some((ref) => ref.id === id && ref.title === "seeded one"));

		const item = await readItem(id);

		assert.equal(item.title, "seeded one");
		assert.equal(item.ready, true);
		assert.deepEqual(item.thread, []);
	});

	add("work source: a comment lands on the thread", async () => {
		const id = await target.seed("commented");

		await source.comment(id, "first words");

		const { thread } = await readItem(id);

		assert.equal(thread.length, 1);
		assert.equal(thread[0]?.kind, "comment");
		assert.equal(thread[0]?.text, "first words");
	});

	add("work source: two claims race and one wins (D5)", async () => {
		const id = await target.seed("raced");
		const b = await second();
		const results = await Promise.all([claimOf(adapter, id, "worker-a"), claimOf(b, id, "worker-b")]);
		const winners = results.filter((result) => result.won);

		assert.equal(winners.length, 1, "exactly one claim wins");

		const holder = winners[0]?.claim.holder;

		for (const result of results) assert.equal(result.claim.holder, holder, "both calls name the winner");

		assert.ok(!(await ready()).some((ref) => ref.id === id), "a claimed item is no longer listed");
		assert.equal((await readItem(id)).ready, false);
	});

	add("work source: the holder renews, another worker cannot", async () => {
		const id = await target.seed("renewed");

		assert.equal((await claimOf(adapter, id, "worker-a")).won, true);
		assert.equal((await claimOf(adapter, id, "worker-a")).won, true, "the holder claiming again renews");
		assert.equal((await claimOf(adapter, id, "worker-a", "renew")).won, true);
		assert.equal((await claimOf(adapter, id, "worker-b", "renew")).won, false);
		assert.equal((await claimOf(adapter, id, "worker-b")).won, false);
	});

	add("work source: an expired claim is taken once (D5)", async () => {
		const id = await target.seed("expired");
		const b = await second();

		assert.equal((await claimOf(adapter, id, "worker-a")).won, true);
		await target.advance(TTL + 1);
		assert.ok((await ready()).some((ref) => ref.id === id), "an expired claim lists the item again");

		const results = await Promise.all([claimOf(adapter, id, "worker-b"), claimOf(b, id, "worker-c")]);

		assert.equal(results.filter((result) => result.won).length, 1, "the expired claim is taken once");
		assert.equal((await claimOf(adapter, id, "worker-a", "renew")).won, false, "the old holder lost it");
	});

	add("work source: a follow-up is listed ready, and filing it twice files it once", async () => {
		const from = await target.seed("parent");
		const first = ItemRef.parse(await source.fileFollowUp(from, { title: "Follow up A", body: "Do A." }));
		const again = ItemRef.parse(await source.fileFollowUp(from, { title: "Follow up A", body: "Do A." }));
		await target.settle?.(async () => (await ready()).some((ref) => ref.id === first.id));

		assert.equal(again.id, first.id);
		assert.equal((await ready()).filter((ref) => ref.id === first.id).length, 1);
		assert.equal((await readItem(first.id)).ready, true);
	});

	const { questions, answers, release } = adapter;

	if (questions) {
		add("questions: a question and a decision land on the thread", async () => {
			const id = await target.seed("asked");

			await questions.ask(id, { text: "Which way?", options: ["left", "right"] });
			await questions.decide(id, "went left");

			const kinds = (await readItem(id)).thread.map((entry) => entry.kind);

			assert.deepEqual(kinds, ["question", "decision"]);
		});
	}

	if (answers) {
		add("answers: an answer lands on the thread with its option", async () => {
			const id = await target.seed("answered");

			await answers.answer(id, { text: "go ahead", option: "approve" });

			const entry = (await readItem(id)).thread[0];

			assert.equal(entry?.kind, "answer");
			assert.equal(entry?.text, "go ahead");
			assert.equal(entry?.option, "approve");
		});

		add("answers: an idle watch costs nothing and a write flips it", async () => {
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
		});
	}

	if (release) {
		add("release: publish and release accept an item", async () => {
			const id = await target.seed("shipped");

			await release.publish(id, "branch-x");
			await release.release(id, "branch-x");
		});
	}

	return checks;
};

export type ContractResult = { readonly name: string; readonly failure?: string };

/** Runs every check and returns each result; nothing stops at the first failure. */
export const runContract = async (target: ContractTarget): Promise<ContractResult[]> => {
	const results: ContractResult[] = [];

	for (const check of contractChecks(target)) {
		try {
			await check.run();
			results.push({ name: check.name });
		} catch (error) {
			results.push({ name: check.name, failure: error instanceof Error ? error.message : String(error) });
		}
	}

	return results;
};
