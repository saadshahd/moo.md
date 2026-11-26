import type { Card, Status } from "../../hum-engine/src/status/format.ts";
import { fullStatus, NOW } from "./status.ts";

/** When the worker wrote the status file the three real cards come from, on 2026-11-26; only the repo's paths are changed. */
const WRITTEN = 1_795_728_628_507;

/** A time of that file, moved so its age against NOW is the age it had when the file was written. */
const moved = (at: number): number => NOW - (WRITTEN - at);

const SLOT_FIX = "The other slots go on. Fix what the check reads, then restart the worker.";

const slotCause = (slot: string, timings: { readonly format: string; readonly lint: string }): string =>
	`${slot} (/repo/.hum-slots/repo-${slot}) left the pool: its ready check failed: pnpm run check exited 1:\nChecking formatting...\n\nAll matched files use the correct format.\nFinished in ${timings.format} on 152 files using 16 threads.\nFound 0 warnings and 0 errors.\nFinished in ${timings.lint} on 69 files with 160 rules using 16 threads.\n\n\x1b[1m\x1b[30m\x1b[46m RUN \x1b[49m\x1b[39m\x1b[22m \x1b[`;

export const SLOT_1: Card = { kind: "fault", key: "slot-out:slot-1", item: "slot-1", code: "slot-out", cause: slotCause("slot-1", { format: "19ms", lint: "5.4s" }), fix: SLOT_FIX, since: moved(1_795_727_233_271) };

export const SLOT_2: Card = { kind: "fault", key: "slot-out:slot-2", item: "slot-2", code: "slot-out", cause: slotCause("slot-2", { format: "34ms", lint: "3.5s" }), fix: SLOT_FIX, since: moved(1_795_727_663_644) };

const ROW_REFUSED: Card = {
	kind: "fault",
	key: "row-refused",
	code: "row-refused",
	cause: "roundup refused hum's run: agent.spawn: cwd_not_in_worktree: /repo/.hum-slots/repo-talk-137 is not in the fresh worktree",
	fix: "In Project ▸ Open Project settings… ▸ Program, enter what `hum setup write` printed, then start the Program again from its row on the Rail.",
	since: moved(1_795_727_702_516),
};

/** The fourth card the owner saw had cleared before the file was read; this is what the engine's `workerSilent` card says. */
const WORKER_DOWN: Card = {
	kind: "fault",
	key: "worker-down",
	code: "worker-down",
	cause: "The worker has written no heartbeat for 90 seconds, 3 ticks.",
	fix: "Look at the unit's log for the cause. Starting the unit again lets the worker start again.",
	since: NOW - 90_000,
};

/** The four fault cards the owner saw in a repo's pane on 2026-11-26, and nothing else to answer. */
export const faultStatus: Status = { ...fullStatus, questions: [], cards: [SLOT_1, SLOT_2, ROW_REFUSED, WORKER_DOWN] };
