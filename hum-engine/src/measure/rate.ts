import type { Boundary } from "../config/schema.ts";

/** The share of measured cases a model got right; none when nothing was measured, so no rate stands in for a measurement. */
export const rateOf = (right: number, measured: number): number | undefined => (measured === 0 ? undefined : right / measured);

const RATE_DIGITS = 2;

/**
 * The owner's measured rates with one pooled rate set at `boundary`, under the model as the owner names it and under
 * each model id that answered while it was measured. Trust compares the ids a call's answer names, which an alias
 * such as `haiku` never is, and the pre-call checks read the name in the owner's settings.
 */
export const withRate = <M extends Partial<Record<Boundary, Readonly<Record<string, number>>>>>(measured: M, { boundary, model, answered, rate }: { readonly boundary: Boundary; readonly model: string; readonly answered: readonly string[]; readonly rate: number }): M => ({
	...measured,
	[boundary]: { ...measured[boundary], ...Object.fromEntries([model, ...answered].map((id) => [id, Number(rate.toFixed(RATE_DIGITS))])) },
});
