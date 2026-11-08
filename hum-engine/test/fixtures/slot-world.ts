import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type PoolOptions, SlotPool } from "../../src/slots/pool.ts";
import { type HumConfig, SHIPPED_DEFAULTS, type SlotRecipe } from "../../src/config/schema.ts";
import { openState } from "../../src/state/open.ts";
import type { Checkout } from "../../src/worker/thin-path.ts";
import { WorkRepo } from "./work-repo.ts";

export const BASE = "main";

export type SlotSettings = {
	readonly runners?: number;
	/** The recipe, or a function of the owner's checkout when the recipe is read from what the checkout holds. */
	readonly recipe?: Partial<SlotRecipe> | ((owner: string) => Partial<SlotRecipe>);
	readonly services?: HumConfig["runSlots"]["services"];
	readonly ports?: HumConfig["runSlots"]["ports"];
	readonly projectPrefix?: string;
	/** Commits to the owner's checkout before the pool opens. */
	readonly seed?: (repo: WorkRepo) => void;
};

/** The pool configuration of a test: slots in `pool`, as many as `runners`. */
export const poolConfig = (pool: string, { runners = 2, recipe = {}, services, ports, projectPrefix }: Omit<SlotSettings, "recipe" | "seed"> & { readonly recipe?: Partial<SlotRecipe> } = {}): PoolOptions["config"] => ({
	runners,
	lockfiles: SHIPPED_DEFAULTS.lockfiles,
	runSlots: { ...SHIPPED_DEFAULTS.runSlots, enabled: true, pool, services: services ?? SHIPPED_DEFAULTS.runSlots.services, ports: ports ?? SHIPPED_DEFAULTS.runSlots.ports, projectPrefix: projectPrefix ?? SHIPPED_DEFAULTS.runSlots.projectPrefix, recipe: { ...SHIPPED_DEFAULTS.runSlots.recipe, ...recipe } },
});

/** An owner\'s checkout with a remote, a pool folder outside it, saved state, and a pool over them. Nothing leaves temp folders. */
export const slotWorld = (settings: SlotSettings = {}, liveRuns?: PoolOptions["liveRuns"]) => {
	const repo = new WorkRepo();
	const pool = mkdtempSync(join(tmpdir(), "hum-pool-"));
	const stateDir = mkdtempSync(join(tmpdir(), "hum-slot-state-"));
	settings.seed?.(repo);

	const { recipe } = settings;
	const config = poolConfig(pool, { ...settings, recipe: recipe instanceof Function ? recipe(repo.owner) : recipe });
	const state = openState(stateDir);
	const options: PoolOptions = { repo: repo.owner, state, config, base: BASE, liveRuns };
	const slots = new SlotPool(options);

	/** A pool over the same saved state, as a restarted worker would open it. */
	const reopened = (alive?: PoolOptions["liveRuns"]) => new SlotPool({ ...options, state: openState(stateDir), liveRuns: alive });

	const ask = (item: string, over: { signal?: AbortSignal; pool?: SlotPool } = {}) => (over.pool ?? slots).checkout({ remote: repo.remote, base: BASE, item, signal: over.signal });

	return {
		repo,
		pool,
		stateDir,
		config,
		state,
		slots,
		ask,
		reopened,
		dispose: () => {
			for (const folder of [repo.root, pool, stateDir]) rmSync(folder, { recursive: true, force: true });
		},
	};
};

export type SlotWorld = ReturnType<typeof slotWorld>;

export type Asked = Awaited<ReturnType<Checkout>>;
