import { BOUNDARIES, type Boundary, type HumConfig } from "../config/schema.ts";

/** The share of measured cases a model got right; none when nothing was measured, so no rate stands in for a measurement. */
export const rateOf = (right: number, measured: number): number | undefined => (measured === 0 ? undefined : right / measured);

const RATE_DIGITS = 2;

type MeasuredModels = HumConfig["measuredModels"];

/** Every boundary with no model measured on it: `hum.json` names each boundary, and an empty one trusts no model there. */
// SAFETY: `Object.fromEntries` loses the keys' type; the entries are every boundary.
const UNMEASURED = Object.fromEntries(BOUNDARIES.map((boundary) => [boundary, {}])) as MeasuredModels;

/**
 * The owner's measured rates with one pooled rate set at `boundary`, beside the hash of what its judge read, under the
 * model as the owner names it and under each model id that answered while it was measured, and every boundary still
 * unmeasured kept with no rate. Trust compares the ids a call's answer names, which an alias such as `haiku` never
 * is, and the pre-call checks read the name in the owner's settings.
 */
export const withRate = (
	measured: Partial<MeasuredModels>,
	{ boundary, model, answered, rate, judgeHash }: { readonly boundary: Boundary; readonly model: string; readonly answered: readonly string[]; readonly rate: number; readonly judgeHash: string },
): MeasuredModels => ({
	...UNMEASURED,
	...measured,
	[boundary]: { ...measured[boundary], ...Object.fromEntries([model, ...answered].map((id) => [id, { rate: Number(rate.toFixed(RATE_DIGITS)), judgeHash }])) },
});
