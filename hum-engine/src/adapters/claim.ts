import { randomUUID } from "node:crypto";
import { z } from "zod";
import { type Claim, type ClaimResult, Holder, type ItemId, PermanentError } from "../adapter-api.ts";
import { parseArgument } from "./argument.ts";

const Ttl = z.int().positive("a claim lasts a positive whole number of milliseconds");

const CLAIM_SUBJECT = /^hum-claim (\S+) (\d+)$/;

export type ClaimMode = "claim" | "renew";

/** A provider's claims. `S` is the standing claim with whatever the provider needs to write over it; `F` is what its write answers when it fails. */
export type ClaimStore<S extends { readonly claim: Claim }, F = never> = {
	readonly standing: (id: ItemId) => Promise<S | undefined>;
	/** Asked only before a first claim: a standing one already proves the item was taken while ready. */
	readonly isReady: (id: ItemId) => Promise<boolean>;
	/** Writes `claim` over `over`; false when another writer moved first, `F` when the write failed. */
	readonly write: (claim: Claim, over: S | undefined) => Promise<boolean | NoInfer<F>>;
};

export type ClaimDecision =
	| { readonly kind: "held"; readonly claim: Claim }
	| { readonly kind: "unheld" }
	| { readonly kind: "write"; readonly first: boolean };

/** A claim stands until it expires. */
export const isLive = (claim: Claim | undefined, now: number): boolean => claim !== undefined && claim.expiresAt > now;

const isHeldByAnother = (standing: Claim, holder: string, now: number): boolean => isLive(standing, now) && standing.holder !== holder;

/**
 * Who may write a claim, given the one standing. An unclaimed or expired item goes to whoever writes first;
 * the holder claiming again renews; a renewal by anyone else loses to the standing claim.
 */
const decideClaim = (mode: ClaimMode, holder: string, standing: Claim | undefined, now: number): ClaimDecision => {
	if (standing && isHeldByAnother(standing, holder, now)) return { kind: "held", claim: standing };

	if (mode === "renew" && standing?.holder !== holder) return standing ? { kind: "held", claim: standing } : { kind: "unheld" };

	return { kind: "write", first: standing === undefined };
};

/** `claim` and `renew` over one provider's store: an atomic take whose race the provider's write settles. */
export const claimer =
	<S extends { readonly claim: Claim }, F = never>(store: ClaimStore<S, F>, now: () => number) =>
	async (mode: ClaimMode, item: ItemId, holder: Holder, ttlMs: number): Promise<ClaimResult | F> => {
		const who = parseArgument(Holder, holder);
		const ttl = parseArgument(Ttl, ttlMs);
		const standing = await store.standing(item);
		const decision = decideClaim(mode, who, standing?.claim, now());

		switch (decision.kind) {
			case "held":
				return { won: false, claim: decision.claim };
			case "unheld":
				throw new PermanentError(`"${who}" holds no claim on "${item}"`);
			case "write": {
				if (decision.first && !(await store.isReady(item))) throw new PermanentError(`item "${item}" is not ready to claim`);

				const claim: Claim = { item, holder: who, expiresAt: now() + ttl };

				const written = await store.write(claim, standing);

				if (written === true) return { won: true, claim };

				if (written !== false) return written;

				const winner = await store.standing(item);

				if (!winner) throw new PermanentError(`the claim on "${item}" lost a race to one that has since vanished`);

				return { won: false, claim: winner.claim };
			}
		}
	};

/** A claim written as a commit. The nonce keeps two writers' commits distinct even when all else matches. */
export const claimCommit = ({ holder, expiresAt }: Claim) => ({
	headline: `hum-claim ${holder} ${expiresAt}`,
	body: `nonce: ${randomUUID()}`,
});

export const claimCommitMessage = (claim: Claim): string => {
	const { headline, body } = claimCommit(claim);

	return `${headline}\n\n${body}`;
};

/** The claim a commit message holds, or undefined for any other commit. */
export const claimOfCommit = (item: ItemId, message: string): Claim | undefined => {
	const [subject = ""] = message.split("\n");
	const match = CLAIM_SUBJECT.exec(subject);
	const holder = Holder.safeParse(match?.[1]);

	return holder.success && match?.[2] ? { item, holder: holder.data, expiresAt: Number(match[2]) } : undefined;
};
