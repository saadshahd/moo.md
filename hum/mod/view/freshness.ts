import type { Unread } from "../../types";

const SECOND_MS = 1000;
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Whole seconds since `at`; never negative, so a clock slightly behind the writer reads as now. */
export const ageSeconds = (at: number, now: number): number => Math.max(0, Math.floor((now - at) / SECOND_MS));

/** An age is amber exactly when it is past the limit. */
export const isAmber = (age: number, amberAfterSeconds: number): boolean => age > amberAfterSeconds;

/** The failing read the view reports: one that has gone on past the amber limit. */
export const reportedUnread = (unread: Unread | undefined, now: number, amberAfterSeconds: number): Unread | undefined => (unread !== undefined && isAmber(ageSeconds(unread.since, now), amberAfterSeconds) ? unread : undefined);

const UNITS = [
	{ from: DAY, big: "d", small: "h", smallEvery: HOUR },
	{ from: HOUR, big: "h", small: "m", smallEvery: MINUTE },
	{ from: MINUTE, big: "m", small: undefined, smallEvery: 1 },
] as const;

/** `40 s`, `6 m`, `1 h 33 m`, `2 d 3 h`: the two biggest units, the second left out when zero. */
export const ageText = (age: number): string => {
	const unit = UNITS.find(({ from }) => age >= from);

	if (unit === undefined) return `${age} s`;

	const big = Math.floor(age / unit.from);
	const small = unit.small === undefined ? 0 : Math.floor((age % unit.from) / unit.smallEvery);

	return small === 0 ? `${big} ${unit.big}` : `${big} ${unit.big} ${small} ${unit.small}`;
};
