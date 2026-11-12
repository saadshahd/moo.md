import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import PQueue from "p-queue";
import { type Git, gitIn, whenGitFailed } from "../adapters/git.ts";
import { hashJson } from "../config/hash.ts";
import type { HumConfig } from "../config/schema.ts";
import { commandTimeoutMs } from "../exec.ts";
import type { State } from "../state/open.ts";
import type { FreeSlot, HeldSlot, Slot } from "../state/saved.ts";
import { SECOND_MS } from "../time.ts";
import { runChecks } from "../worker/checks.ts";
import type { Checkedout, Checkout } from "../worker/thin-path.ts";
import { slotEnv, slotFolder, slotName } from "./env.ts";
import { isWorktreeOf } from "./worktree.ts";

export const SLOT_OUT_CODE = "slot-out";

export const SLOT_KEPT_CODE = "slot-kept";

export const SLOT_MAINTENANCE_CODE = "slot-maintenance";

const CARD_OUTPUT = 400;

const CHANGE = "change";

export type PoolOptions = {
	/** The owner's checkout: the repo every slot is a worktree of. */
	readonly repo: string;
	readonly state: Pick<State, "slots" | "faults" | "runs">;
	readonly config: Pick<HumConfig, "runners" | "runSlots" | "lockfiles" | "commandTimeoutSeconds">;
	readonly base: string;
	/** The names of the runs alive outside this process; a taken slot whose item has none of them is returned. */
	readonly liveRuns?: () => Promise<ReadonlySet<string>>;
	readonly now?: () => number;
};

const nextChange = (changes: EventTarget, signal: AbortSignal | undefined): Promise<void> =>
	new Promise((resolveChange, reject) => {
		const changed = () => {
			signal?.removeEventListener("abort", aborted);
			resolveChange();
		};

		const aborted = () => {
			changes.removeEventListener(CHANGE, changed);
			reject(signal?.reason);
		};

		changes.addEventListener(CHANGE, changed, { once: true });
		signal?.addEventListener("abort", aborted, { once: true });
	});

const isHeld = (slot: Slot): slot is HeldSlot => slot.status === "taken" || slot.status === "kept";

/** The slot with no item, at a free status. */
const freed = ({ name, index, folder, lockfiles, since }: Slot, status: FreeSlot["status"]): FreeSlot => ({ name, index, folder, lockfiles, status, since });

/**
 * The run slots: git worktrees of the owner's checkout, kept prepared so a run starts in one at once. A slot serves
 * one item's pass at a time. It is saved as taken before the pass starts and returned once the pass ends, when its
 * branch holds nothing the remote lacks. Heavy work (installs, data resets, ready checks) runs between passes.
 */
export class SlotPool {
	readonly #o: PoolOptions;
	readonly #queue = new PQueue({ concurrency: 1 });
	readonly #changes = new EventTarget();
	/** Slots whose pass runs in this process, by slot name. */
	readonly #active = new Map<string, string>();
	readonly #returning = new Set<string>();
	readonly #now: () => number;
	#recheckOut = true;

	constructor(options: PoolOptions) {
		this.#o = options;
		this.#now = options.now ?? Date.now;
	}

	get #settings(): HumConfig["runSlots"] {
		return this.#o.config.runSlots;
	}

	#slots(): Slot[] {
		return this.#o.state.slots
			.list()
			.filter(({ index }) => index < this.#o.config.runners)
			.sort((a, b) => a.index - b.index);
	}

	#save<S extends Slot>(next: S): S {
		const saved = { ...next, since: this.#now() };

		this.#o.state.slots.put(saved.name, saved);
		this.#changes.dispatchEvent(new Event(CHANGE));

		return saved;
	}

	#envOf(slot: Slot): Record<string, string> {
		return slotEnv(this.#settings, slot);
	}

	#run(slot: Slot, commands: readonly string[]): Promise<string | undefined> {
		return runChecks(commands, slot.folder, { env: this.#envOf(slot), timeoutMs: this.#settings.stepTimeoutSeconds * SECOND_MS });
	}

	#git(folder: string): Git {
		return gitIn(folder, { timeoutMs: commandTimeoutMs(this.#o.config) });
	}

	#lockfiles(folder: string): string {
		const present = this.#o.config.lockfiles.filter((file) => existsSync(join(folder, file)));

		return hashJson(Object.fromEntries(present.map((file) => [file, readFileSync(join(folder, file), "utf8")])));
	}

	#out(slot: Slot, cause: string, fix: string): void {
		this.#save(freed(slot, "out"));
		this.#o.state.faults.raise({ code: SLOT_OUT_CODE, item: slot.name, cause: `${slot.name} (${slot.folder}) left the pool: ${cause}`.slice(0, CARD_OUTPUT), fix });
	}

	#ready(slot: Slot, lockfiles: string): void {
		this.#o.state.faults.clear(`${SLOT_OUT_CODE}:${slot.name}`);
		this.#save({ ...freed(slot, "free"), lockfiles });
	}

	/** Makes the slot's worktree if it is not there, runs the recipe's prepare and ready; a failure takes the slot out. */
	async #prepare(slot: Slot): Promise<void> {
		const { repo, base } = this.#o;

		if (existsSync(slot.folder)) {
			if (!(await isWorktreeOf(repo, slot.folder, commandTimeoutMs(this.#o.config)).catch(whenGitFailed(false))))
				return this.#out(slot, `${slot.folder} is not a git worktree of ${repo}.`, "A slot is a worktree of the checkout: Claude Code trusts a worktree of a trusted repo and refuses a repo of its own. Remove the folder; hum makes the slot again at its next start.");
		} else {
			mkdirSync(dirname(slot.folder), { recursive: true });
			await this.#git(repo).raw(["fetch", "-q", "origin"]);
			await this.#git(repo).raw(["worktree", "add", "-q", "--detach", slot.folder, `origin/${base}`]);
		}

		const { prepare, ready } = this.#settings.recipe;
		const failure = await this.#run(slot, prepare);

		if (failure) return this.#out(slot, `its prepare failed: ${failure}`, "Fix the recipe's prepare command or what it needs, then restart the worker.");

		await this.#check(slot, ready, this.#lockfiles(slot.folder));
	}

	async #check(slot: Slot, ready: readonly string[], lockfiles: string): Promise<void> {
		const failure = await this.#run(slot, ready);

		return failure ? this.#out(slot, `its ready check failed: ${failure}`, "The other slots go on. Fix what the check reads, then restart the worker.") : this.#ready(slot, lockfiles);
	}

	/** Resets the returned slot to the latest base, runs the steps its lockfile change calls for, then the ready check. */
	async #refresh(slot: Slot): Promise<void> {
		const { base } = this.#o;
		const git = this.#git(slot.folder);

		await git.raw(["fetch", "-q", "origin"]);
		await git.raw(["reset", "-q", "--hard"]);
		await git.raw(["clean", "-fdq"]);
		await git.raw(["checkout", "-q", "--detach", `origin/${base}`]);

		const lockfiles = this.#lockfiles(slot.folder);
		const changed = lockfiles !== slot.lockfiles;
		const steps = this.#settings.recipe.refresh.filter(({ when }) => when === "always" || changed).map(({ run }) => run);
		const failure = await this.#run(slot, steps);

		if (failure) return this.#out(slot, `its refresh failed: ${failure}`, "Fix the recipe's refresh command or what it needs, then restart the worker.");

		await this.#check(slot, this.#settings.recipe.ready, lockfiles);
	}

	#keep(slot: HeldSlot, cause: string, fix: string): void {
		this.#save({ ...slot, status: "kept" });
		this.#o.state.faults.raise({ code: SLOT_KEPT_CODE, item: slot.name, cause: `${slot.name} (${slot.folder}) stays taken: ${cause}`.slice(0, CARD_OUTPUT), fix });
	}

	/**
	 * Returns the slot to the pool once its branch holds no commit the remote lacks: resets it, detaches it at the base
	 * and deletes the run's branch. A slot that cannot be returned stays taken with one card, and its commits are left alone.
	 */
	async #give(slot: HeldSlot): Promise<void> {
		if (this.#returning.has(slot.name)) return;

		this.#returning.add(slot.name);
		this.#active.delete(slot.name);

		try {
			const git = this.#git(slot.folder);

			await git.raw(["fetch", "-q", "origin"]);

			const ahead = Number((await git.raw(["rev-list", "--count", "HEAD", "--not", "--remotes=origin"])).trim());
			const branch = (await git.run(["symbolic-ref", "-q", "--short", "HEAD"])).stdout.trim();

			if (ahead > 0) return this.#keep(slot, `${branch || "its checkout"} holds ${ahead} commit(s) the remote lacks.`, `Push them from the slot, or delete the branch to drop them; hum returns the slot at its next tick.`);

			await git.raw(["reset", "-q", "--hard"]);
			await git.raw(["clean", "-fdq"]);
			await git.raw(["checkout", "-q", "--detach", `origin/${this.#o.base}`]);

			if (branch) await git.raw(["branch", "-q", "-D", branch]);

			this.#o.state.faults.clear(`${SLOT_KEPT_CODE}:${slot.name}`);
			this.#save(freed(slot, "stale"));
		} catch (error) {
			this.#keep(slot, `it could not be returned: ${error instanceof Error ? error.message : String(error)}`, "Fix what git reports in the slot; hum returns the slot at its next tick.");
		} finally {
			this.#returning.delete(slot.name);
		}

		this.keepReady();
	}

	/** A taken slot with no pass in this process and no run alive for its item is returned. A run alive for it is adopted. */
	async #reclaim(): Promise<void> {
		const orphans = this.#slots().filter(isHeld).filter((slot) => !this.#active.has(slot.name) && !this.#returning.has(slot.name));

		if (orphans.length === 0) return;

		const alive = (await this.#o.liveRuns?.()) ?? new Set<string>();

		for (const slot of orphans) {
			const adopted = this.#o.state.runs.list(slot.item).some(({ name, endedAt }) => endedAt === undefined && alive.has(name));

			if (!adopted) await this.#give(slot);
		}
	}

	#settle(slot: Slot): Promise<void> {
		if (slot.status === "new") return this.#prepare(slot);

		return slot.status === "stale" ? this.#refresh(slot) : Promise.resolve();
	}

	async #maintain(): Promise<void> {
		const { state, config } = this.#o;
		const recheck = this.#recheckOut;

		this.#recheckOut = false;

		await this.#reclaim().catch((error: Error) => this.#maintenanceFailed("reclaim", error));

		for (let index = 0; index < config.runners; index++) {
			const name = slotName(index);

			if (!state.slots.get(name)) this.#save({ name, index, folder: slotFolder(this.#o.repo, this.#settings.pool, name), status: "new", since: 0 });
		}

		for (const listed of this.#slots()) {
			const slot = recheck && listed.status === "out" ? this.#save(freed(listed, "new")) : listed;

			await this.#settle(slot).then(
				() => state.faults.clear(`${SLOT_MAINTENANCE_CODE}:${slot.name}`),
				(error: Error) => this.#maintenanceFailed(slot.name, error),
			);
		}
	}

	#maintenanceFailed(name: string, error: Error): void {
		this.#o.state.faults.raise({ code: SLOT_MAINTENANCE_CODE, item: name, cause: `Run slot upkeep for ${name} failed: ${error.message}`.slice(0, CARD_OUTPUT), fix: "hum tries again at its next tick." });
	}

	/** One upkeep pass: slots made, returned slots refreshed, orphans returned. Resolves when the pass has run. */
	maintain(): Promise<void> {
		return this.#queue.add(() => this.#maintain());
	}

	/** Asks for an upkeep pass without waiting for it; one already waiting covers the ask. */
	keepReady(): void {
		if (this.#queue.size === 0) void this.maintain();
	}

	/** Resolves when no upkeep is running or waiting. */
	idle(): Promise<void> {
		return this.#queue.onIdle();
	}

	/** The slots, in order. */
	list(): Slot[] {
		return this.#slots();
	}

	/** The slot for the item's pass: the one that already holds the item, else the first free one, waiting for a return when none is. */
	async #take(request: Parameters<Checkout>[0]): Promise<{ readonly slot: HeldSlot; readonly held: boolean }> {
		const { signal, item } = request;

		for (;;) {
			signal?.throwIfAborted();

			const slots = this.#slots();
			const held = slots.filter(isHeld).find((slot) => slot.item === item && !this.#returning.has(slot.name));
			const taking = held ?? slots.find(({ status }) => status === "free");

			if (taking) {
				this.#active.set(taking.name, item);

				return held ? { slot: held, held: true } : { slot: this.#save({ ...freed(taking, "free"), status: "taken", item }), held: false };
			}

			if (slots.length === this.#o.config.runners && slots.every(({ status }) => status === "out")) throw new Error(`every run slot is out of the pool: ${this.#o.state.faults.list().filter(({ code }) => code === SLOT_OUT_CODE).map(({ cause }) => cause).join("; ")}`);

			this.keepReady();
			await nextChange(this.#changes, signal);
		}
	}

	/** The seam a thin-path pass takes its working copy from: a slot, at the latest base, with its own ports and database. */
	readonly checkout: Checkout = async (request): Promise<Checkedout> => {
		const { repo, base } = this.#o;
		const origin = (await this.#git(repo).raw(["remote", "get-url", "origin"])).trim();

		if (request.remote !== origin) throw new Error(`run slots work from origin (${origin}), and this pass asks for ${request.remote}`);

		if (request.base !== base) throw new Error(`run slots keep ${base} ready, and this pass asks for ${request.base}`);

		const { slot, held } = await this.#take(request);
		const git = this.#git(slot.folder);

		try {
			await git.raw(["fetch", "-q", "origin"]);
			// A slot the item already held keeps its commits; any other starts at the latest base.
			await git.raw(["checkout", "-q", "--detach", ...(held ? [] : [`origin/${base}`])]);
		} catch (error) {
			await this.#give(slot);

			throw error;
		}

		return { folder: slot.folder, env: this.#envOf(slot), giveBack: () => this.#give(slot) };
	};
}
