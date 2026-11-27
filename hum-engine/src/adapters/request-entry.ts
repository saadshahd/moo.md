import { NOTE_KIND, type OwnerRequest, type RequestKind } from "../adapter-api.ts";
import type { Marker } from "./marked.ts";

/** What each request asks, in the words its thread entry shows the owner. */
const ASKED = {
	skip: (step) => `Skip ${step}.`,
	"run-now": (step) => `Run the timer of ${step} now.`,
} as const satisfies Record<RequestKind, (step: string) => string>;

/** A request as a thread entry: its marker names its kind and step, and its text says what the owner asked; a note's text is the owner's own. */
export const requestEntry = (request: OwnerRequest) => ({
	marker: { kind: request.kind, step: request.step } satisfies Marker,
	text: request.kind === NOTE_KIND ? request.text : ASKED[request.kind](request.step),
});
