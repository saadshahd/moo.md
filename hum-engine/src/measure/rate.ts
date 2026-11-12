/** The share of measured cases a model got right; none when nothing was measured, so no rate stands in for a measurement. */
export const rateOf = (right: number, measured: number): number | undefined => (measured === 0 ? undefined : right / measured);
