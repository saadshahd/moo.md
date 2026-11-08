import type { Measure, Status } from "../../../hum-engine/src/status/format.ts";
import { isNewer } from "../vendor/libs.js";
import { RUNNERS, runnerPart } from "./ages.ts";
import { droppingFromEnd, firstFitting, joinParts } from "./fit.ts";
import type { Row, Span } from "./row.ts";
import { span } from "./row.ts";

const THOUSAND = 1000;
const MILLION = THOUSAND * THOUSAND;

/** `950`, `310k`, `1.2M`. */
export const tokensText = (tokens: number): string => {
	if (tokens < THOUSAND) return String(Math.round(tokens));

	return tokens < MILLION ? `${Math.round(tokens / THOUSAND)}k` : `${(tokens / MILLION).toFixed(1)}M`;
};

const perMerge = (value: number): string => String(Number(value.toFixed(1)));

const engineText = ({ version, latest }: Status["engine"]): string => (latest !== undefined && isNewer(latest, version) ? `engine ${version} (${latest} available)` : `engine ${version}`);

/** Mac and CI ages, then the engine version, dropping from the end. One row. */
export const headerRow = (status: Status, now: number, amberAfterSeconds: number, width: number): Row => {
	const ages = RUNNERS.flatMap((runner) => runnerPart(status, runner, now, amberAfterSeconds, " ago") ?? []);

	return firstFitting(droppingFromEnd([...ages, span(engineText(status.engine), "dim")]), width);
};

const NO_MEASURE = "per merge: no merged change yet";

/**
 * The measure line: notes, questions and tokens per merged change. Tokens drop first, then questions, then the
 * label; the notes stay. It never wraps.
 */
export const measureRow = (measure: Measure | null, width: number): Row => {
	if (measure === null) return firstFitting([[span(NO_MEASURE, "dim")]], width);

	const label = `per merge (last ${measure.window}): `;
	const parts: Span[] = [span(`${perMerge(measure.notes)} notes`, "plain"), span(`${perMerge(measure.questions)} questions`, "plain"), span(`${tokensText(measure.tokens)} tokens`, "plain")];
	const labelled = droppingFromEnd(parts).map(([first, ...rest]) => (first === undefined ? [] : [span(`${label}${first.text}`, first.tone), ...rest]));

	return firstFitting([...labelled, joinParts(parts.slice(0, 1))], width);
};
