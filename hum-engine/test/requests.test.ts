import { expect, test } from "bun:test";
import type { ThreadEntry } from "../src/adapter-api.ts";
import { decideRequest, pendingRequest, type RequestStand, requestsOn } from "../src/decide/request.ts";

const SAVED_AT = 100;

const atWait: RequestStand = { at: "objecting", savedAt: SAVED_AT, controls: { skip: true, runNow: true }, answered: false, parked: false };

const request = (kind: "skip" | "run-now", step: string | undefined, at = SAVED_AT + 1): ThreadEntry => ({ kind, text: `${kind} ${step}`, at, step, author: "hum" });

const decided = (entry: ThreadEntry, stand: RequestStand = atWait, earlierApplies = false) => {
	const [found] = requestsOn([entry]);

	if (found === undefined) throw new Error("the entry is no request");

	return decideRequest(found, stand, earlierApplies);
};

test("a request made at the wait the item is at, which the wait allows, applies", () => {
	expect(decided(request("run-now", "objecting"))).toEqual({ disposition: "applied", why: "the timer of objecting fires now" });
	expect(decided(request("skip", "objecting")).disposition).toBe("applied");
});

test("a request is refused with its reason: no step, a parked item, a step left or not reached, a wait that does not allow it, an answer first, an earlier request", () => {
	const why = (entry: ThreadEntry, stand?: RequestStand, earlier?: boolean) => decided(entry, stand, earlier).why;

	expect(why(request("skip", undefined))).toBe("it names no step");
	expect(why(request("skip", "objecting"), { ...atWait, parked: true })).toBe("the item is parked: act on its card first");
	expect(why(request("skip", "objecting", SAVED_AT - 1))).toBe("the item came to objecting after this request");
	expect(why(request("skip", "building"))).toBe("the item is at objecting now, not building");
	expect(why(request("skip", "objecting"), { ...atWait, at: undefined, savedAt: undefined })).toBe("the item has no saved step");
	expect(why(request("skip", "objecting"), { ...atWait, controls: { skip: false, runNow: true } })).toContain("objecting is not a step the owner may skip");
	expect(why(request("run-now", "objecting"), { ...atWait, controls: { skip: true, runNow: false } })).toContain("objecting has no timer the owner may run");
	expect(why(request("skip", "objecting"), { ...atWait, answered: true })).toBe("the owner's answer at objecting came first");
	expect(why(request("skip", "objecting"), atWait, true)).toBe("an earlier request at objecting applies");
});

test("the request that acts now is the first applied one made at this visit, and none acts once an answer released the wait", () => {
	const thread = [request("skip", "objecting", SAVED_AT - 1), { kind: "comment", text: "a remark", at: SAVED_AT + 1 } satisfies ThreadEntry, request("run-now", "objecting"), request("skip", "objecting", SAVED_AT + 2)];
	const requests = requestsOn(thread);
	const applied = () => ({ disposition: "applied", why: "ok" }) as const;

	expect(requests.map(({ ordinal, entry }) => [ordinal, entry.kind])).toEqual([[1, "skip"], [2, "run-now"], [3, "skip"]]);
	expect(pendingRequest(requests, applied, atWait)).toBe("run-now");
	expect(pendingRequest(requests, applied, { ...atWait, answered: true })).toBeUndefined();
	expect(pendingRequest(requests, applied, { ...atWait, at: "building" })).toBeUndefined();
});
