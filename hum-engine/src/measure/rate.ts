import { BOUNDARIES, type Boundary, type HumConfig } from "../config/schema.ts";
import { modelIdOf } from "../decide/prose.ts";

/** The share of measured cases a model got right; none when nothing was measured, so no rate stands in for a measurement. */
export const rateOf = (right: number, measured: number): number | undefined => (measured === 0 ? undefined : right / measured);

const RATE_DIGITS = 2;

type MeasuredModels = HumConfig["measuredModels"];

/** Every boundary with no model measured on it: `hum.json` names each boundary, and an empty one trusts no model there. */
// SAFETY: `Object.fromEntries` loses the keys' type; the entries are every boundary.
const UNMEASURED = Object.fromEntries(BOUNDARIES.map((boundary) => [boundary, {}])) as MeasuredModels;

/**
 * The owner's measured rates with one pooled rate set at `boundary`, beside the hash of what its judge read, and every
 * boundary still unmeasured kept with no rate. The rate goes under the model as the owner names it and under the model
 * id each answering id names, in place of every rate recorded for those models. Trust compares the ids a call's answer
 * names, which an alias such as `haiku` never is, and the pre-call checks read the name in the owner's settings.
 */
export const withRate = (
	measured: Partial<MeasuredModels>,
	{ boundary, model, answered, rate, judgeHash }: { readonly boundary: Boundary; readonly model: string; readonly answered: readonly string[]; readonly rate: number; readonly judgeHash: string },
): MeasuredModels => {
	const ids = new Set([model, ...answered].map(modelIdOf));
	const kept = Object.entries(measured[boundary] ?? {}).filter(([recorded]) => !ids.has(modelIdOf(recorded)));
	const score = { rate: Number(rate.toFixed(RATE_DIGITS)), judgeHash };

	return { ...UNMEASURED, ...measured, [boundary]: Object.fromEntries([...kept, ...[...ids].map((id) => [id, score] as const)]) };
};
