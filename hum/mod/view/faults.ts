import type { Card, Status } from "../../../hum-engine/src/status/format.ts";
import type { Dismissal } from "../../types";

/** Fault cards of one code that name an item show as one card; a card without an item stands alone. */
const groupOf = (card: Card): string => (card.item === undefined ? `alone:${card.key}` : `code:${card.code}`);

const dismissalOf = ({ key, since }: Dismissal): Dismissal => ({ key, since });

const isDismissed =
	(dismissed: readonly Dismissal[]) =>
	(card: Card): boolean =>
		dismissed.some(({ key, since }) => key === card.key && since === card.since);

/** The fault groups a pane shows, in the engine's order. A group hides only while every card in it is dismissed, so a card raised again or a new place shows it whole. */
export const shownFaultGroups = ({ cards }: Pick<Status, "cards">, dismissed: readonly Dismissal[]): Card[][] =>
	[...cards.reduce((groups, card) => (card.kind === "fault" ? groups.set(groupOf(card), [...(groups.get(groupOf(card)) ?? []), card]) : groups), new Map<string, Card[]>()).values()].filter((group) => !group.every(isDismissed(dismissed)));

/** What dismissing a group keeps: every card in it. */
export const dismissalsOf = (group: readonly Card[]): Dismissal[] => group.map(dismissalOf);

/** One dismissal per card still raised, so the file never outgrows the cards. */
export const keptDismissals = (cards: readonly Card[], dismissed: readonly Dismissal[]): Dismissal[] => cards.flatMap((card) => (isDismissed(dismissed)(card) ? [dismissalOf(card)] : []));
