import type { Refusal } from "./refusal.ts";
import { type Config, type LoadOptions, loadConfig, type RawConfig } from "./load.ts";
import { type SavedItem, unmappedItems } from "./state-map.ts";

/** The branch prefix of every hum run (C1). */
export const HUM_RUN_BRANCH_PREFIX = "hum/";

export const isRunBranch = (branch: string): boolean => branch.startsWith(HUM_RUN_BRANCH_PREFIX);

export type ConfigChange = {
	readonly candidate: RawConfig;
	/** The branch the change sits on. */
	readonly branch: string;
	/** Items saved now, so a removed or renamed state can be checked (V3). */
	readonly saved?: readonly SavedItem[];
};

/** Accepted: `config` is the new one. Refused: `config` is the last good one, untouched. */
export type ConfigResult =
	| { readonly accepted: true; readonly config: Config }
	| { readonly accepted: false; readonly config: Config | undefined; readonly refusals: readonly Refusal[] };

/**
 * One path for start and for every change. Refuses a change from a hum run's branch (C1),
 * a config that fails a check (V4, C2, C3, D7) and a state map that strands a saved item (V3).
 */
export const applyConfigChange = (current: Config | undefined, change: ConfigChange, options: LoadOptions): ConfigResult => {
	const refuse = (...refusals: Refusal[]): ConfigResult => ({ accepted: false, config: current, refusals });

	if (isRunBranch(change.branch)) {
		return refuse({
			code: "change-from-run",
			branch: change.branch,
			message: `The config change came from a hum run's branch "${change.branch}". Only the owner changes hum; the last good config stays.`,
		});
	}

	const loaded = loadConfig(change.candidate, options);

	if (!loaded.ok) return refuse(loaded.refusal);
	const stranded = current ? unmappedItems(current, loaded.value, change.saved ?? []) : [];

	if (stranded.length > 0) {
		return refuse({
			code: "unmapped-state",
			items: stranded,
			message: `Saved items sit in states the new config removes with no map: ${stranded.map((i) => `${i.kind}/${i.state}`).join(", ")}. Add a stateMap for the earlier version.`,
		});
	}

	return { accepted: true, config: loaded.value };
};

