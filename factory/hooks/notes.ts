import type { EngineInterface, ToolCallResult } from "claude-code";
import type { Actors, Comment } from "../lib/github.ts";
import { actorsOf, readRules } from "../lib/rules.ts";
import { comments } from "../lib/snapshot.ts";
import { notes } from "../lib/wait.ts";
import { currentRun, runner, showOnce } from "./session.ts";

const NOTE_EVERY_MS = 60_000;

/**
 * The notes trusted people wrote after comment `afterId` and after `sinceMs`, oldest first. What
 * came before the session started reached it in its prompt.
 */
export function unseenNotes(
  cs: readonly Comment[],
  a: Actors,
  afterId: number,
  sinceMs: number,
): Comment[] {
  return notes(cs, a).filter((c) => c.id > afterId && Date.parse(c.createdAt) > sinceMs);
}

/** After a tool call in a factory run, at most once a minute: the issue's new notes reach the agent. */
export async function passNewNotes(
  $: EngineInterface,
  r: ToolCallResult,
): Promise<ToolCallResult> {
  if (r.deny !== undefined) return r;

  try {
    const fr = await currentRun($);
    const { value: at = 0 } = await $.state.get({ plugin: "factory", key: "notesAt" });
    const now = await $.clock.now();

    if (!fr || now - at < NOTE_EVERY_MS) return r;
    await $.state.set({ plugin: "factory", key: "notesAt" }, now);
    /** Keyed by issue, not session: a restarted run never takes the same note twice. */
    const seenKey = `notes:seen:${fr.repo}#${fr.issue}`;
    const seen = Number((await $.store.get(seenKey)) ?? 0);
    const { startedAt } = await $.session.usage();
    const run = runner($);
    const actors = actorsOf(await readRules(run, fr.cwd), fr.repo);
    const fresh = unseenNotes(await comments(run, fr.repo, fr.issue), actors, seen, startedAt);
    const last = fresh.at(-1);

    if (last === undefined) return r;
    await $.store.set(seenKey, last.id);

    const said = fresh.map(
      (n) => `A note from @${n.author} on issue #${fr.issue}, posted ${n.createdAt}:\n\n${n.body}`,
    );

    return { ...r, context: [...(r.context ?? []), ...said] };
  } catch (err) {
    await showOnce($, String(err));

    return r;
  }
}
