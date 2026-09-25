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

export type Slop = {
  /** Findings waiting for a fix-or-skip decision, oldest first. */
  findings: Finding[];
  /** The finding the review asks about; the ones before it are decided. */
  cursor: number;
  /** The decision on each finding before the cursor, in order. */
  marks: ("fix" | "skip")[];
  /** The review pane is open, so the row above the prompt asks fix or skip. */
  reviewing: boolean;
  /** Findings the person chose to fix; the next submit that keeps the fix stem carries them. */
  chosen: Finding[];
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
