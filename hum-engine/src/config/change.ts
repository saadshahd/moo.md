import type { Refusal } from "./refusal.ts";
import { type Config, type LoadOptions, loadConfig, type RawConfig } from "./load.ts";
import { type Naming, SHIPPED_DEFAULTS } from "./schema.ts";
import { type SavedItem, unmappedItems } from "./state-map.ts";

/** A branch hum itself writes: a run's or a claim's. */
export const isHumBranch = (branch: string, { runBranchPrefix, claimPrefix }: Naming): boolean =>
	[runBranchPrefix, claimPrefix].some((prefix) => branch.startsWith(prefix));

export type ConfigChange = {
	readonly candidate: RawConfig;
	/** The branch the change sits on. */
	readonly branch: string;
	/** Items saved now, so a removed or renamed state can be checked. */
	readonly saved?: readonly SavedItem[];
};

/** Accepted: `config` is the new one. Refused: `config` is the last good one, untouched. */
export type ConfigResult =
	| { readonly accepted: true; readonly config: Config }
	| { readonly accepted: false; readonly config: Config | undefined; readonly refusals: readonly Refusal[] };

/**
 * One path for start and for every change. Refuses a change from a branch hum writes, judged by the last good
 * config's prefixes so a change cannot rename its own way out; a config that fails a check; and a state map
 * that strands a saved item.
 */
export const applyConfigChange = (current: Config | undefined, change: ConfigChange, options: LoadOptions): ConfigResult => {
	const refuse = (...refusals: Refusal[]): ConfigResult => ({ accepted: false, config: current, refusals });

	if (isHumBranch(change.branch, current?.hum ?? SHIPPED_DEFAULTS)) {
		return refuse({
			code: "change-from-run",
			branch: change.branch,
			message: `The config change came from a branch hum writes, "${change.branch}". Only the owner changes hum; the last good config stays.`,
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

