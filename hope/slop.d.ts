// hope's contract: the session state the slop judge writes and its review reads.
// Held by the host for the session only. Callers spell the ref as a literal in their own file:
// { plugin: "hope", key: "slop" }.

/** One judge finding. A line the judge wrote in another shape keeps only its text as `claim`. */
export type Finding = {
  file?: string;
  line?: number;
  /** The violated preference, a few words. */
  rule: string;
  /** What is wrong there, one sentence. */
  claim: string;
  /** The judge's suggested change: the current lines from `line` on, and their replacement. */
  before: string[];
  after: string[];
};

/** The decision on one finding: accept writes its change to the file (or hands it to Claude when it
 * carries none), edit hands it to Claude with what the person wants instead, reject drops it. */
export type Mark =
  | { kind: "accept" }
  | { kind: "edit"; note: string }
  | { kind: "reject" };

/** A finding for Claude to fix, with the person's words when they edited it. */
export type Chosen = { finding: Finding; note?: string };

export type Slop = {
  /** Findings waiting for a decision, oldest first. */
  findings: Finding[];
  /** The finding the review asks about; the ones before it are decided. */
  cursor: number;
  /** The decision on each finding before the cursor, in order. */
  marks: Mark[];
  /** The review pane is open, so the row above the prompt asks accept, edit or reject. */
  reviewing: boolean;
  /** The row holds the field for the edit of the finding under the cursor. */
  editing: boolean;
  /** Findings for Claude; the next submit that keeps the fix stem carries them. */
  chosen: Chosen[];
  /** Keys of every finding or failure shown this session, so each shows once. */
  seen: string[];
  /** How many session messages were already scanned for touched files. */
  offset: number;
};

declare module "claude-code" {
  interface PluginState {
    hope: { slop: Slop };
  }
}
