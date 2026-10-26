// Facts read from a Claude Code session transcript (`~/.claude/projects/<dir>/<session>.jsonl`).
// One API message spans several lines, one per content block, each repeating the message's
// `usage`, so tokens count once per `message.id`.

export type Usage = {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
};

type Block = {
  type?: string;
  name?: string;
  id?: string;
  tool_use_id?: string;
};

type Line = {
  type?: string;
  message?: {
    id?: string;
    /** Content blocks; a user line's content may be a plain string instead. */
    content?: string | Block[];
    usage?: {
      input_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
      output_tokens?: number;
    };
  };
  quotaLimits?: { status?: string; resetsAt?: number };
};

function lines(jsonl: string): Line[] {
  return jsonl.split("\n").flatMap((l) => {
    if (l.trim() === "") return [];

    try {
      // SAFETY: Line names every field optional, so any JSON object Claude Code wrote fits it.
      return [JSON.parse(l) as Line];
    } catch {
      return []; // a line cut off mid-write by a live session
    }
  });
}

/** Tokens the transcript's assistant messages spent, each message once. */
export function usage(jsonl: string): Usage {
  const seen = new Map<string, Usage>();

  for (const l of lines(jsonl)) {
    const u = l.message?.usage;
    const id = l.message?.id;

    if (l.type !== "assistant" || !u || !id) continue;
    seen.set(id, {
      input: u.input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      output: u.output_tokens ?? 0,
    });
  }

  return sum([...seen.values()]);
}

export function sum(us: readonly Usage[]): Usage {
  return us.reduce(
    (a, u) => ({
      input: a.input + u.input,
      cacheRead: a.cacheRead + u.cacheRead,
      cacheWrite: a.cacheWrite + u.cacheWrite,
      output: a.output + u.output,
    }),
    { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 },
  );
}

/** Tokens the newest assistant message read as context: what the next turn re-reads. */
export function contextSize(jsonl: string): number {
  const last = lines(jsonl)
    .filter((l) => l.type === "assistant" && l.message?.usage)
    .at(-1)?.message?.usage;

  return last
    ? (last.input_tokens ?? 0) +
        (last.cache_read_input_tokens ?? 0) +
        (last.cache_creation_input_tokens ?? 0)
    : 0;
}

/** Whether the session's newest AskUserQuestion still has no answer: the run waits on the human. */
export function pendingAsk(jsonl: string): boolean {
  const asked: string[] = [];
  const answered = new Set<string>();

  for (const l of lines(jsonl)) {
    const content = l.message?.content;

    if (!Array.isArray(content)) continue;

    for (const b of content) {
      if (b.type === "tool_use" && b.name === "AskUserQuestion" && b.id)
        asked.push(b.id);

      if (b.type === "tool_result" && b.tool_use_id)
        answered.add(b.tool_use_id);
    }
  }

  const last = asked.at(-1);

  return last !== undefined && !answered.has(last);
}

/**
 * When the session's last reply was Claude refusing for a usage limit, the time it said the limit
 * resets, in epoch seconds; null when anything else came last. Claude writes the refusal as
 * a synthetic assistant line with `quotaLimits: { status: "rejected", resetsAt }`.
 */
export function rejectedUntil(jsonl: string): number | null {
  const q = lines(jsonl)
    .filter((l) => l.type === "assistant")
    .at(-1)?.quotaLimits;

  return q?.status === "rejected" && q.resetsAt !== undefined
    ? q.resetsAt
    : null;
}
