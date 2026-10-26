// The worker's view of the machine: commands, Claude Code's background sessions, their transcripts.

import { homedir } from "node:os";
import { join } from "node:path";
import type { Run } from "../lib/github.ts";

export const run: Run = async (argv, opts) => {
  const p = Bun.spawn([...argv], {
    cwd: opts?.cwd,
    stdin:
      opts?.stdin === undefined
        ? "ignore"
        : new TextEncoder().encode(opts.stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(p.stdout).text(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  return { exitCode, stdout, stderr };
};

/** A Claude Code session as `claude agents --json --all` lists it. */
export type Session = {
  id: string;
  sessionId: string;
  name: string | null;
  cwd: string;
  startedAt: number;
  /** `working`, `blocked` (its turn ended, or it waits on an ask), `stopped`, … */
  state: string;
};

export async function sessions(): Promise<Session[]> {
  const r = await run(["claude", "agents", "--json", "--all"]);
  if (r.exitCode !== 0)
    throw new Error(`claude agents failed: ${r.stderr.trim()}`);
  return JSON.parse(r.stdout) as Session[];
}

/** The session's transcript text, or "" when Claude Code has not written one yet. */
export async function transcript(sessionId: string): Promise<string> {
  const root = join(homedir(), ".claude", "projects");
  for await (const f of new Bun.Glob(`*/${sessionId}.jsonl`).scan({
    cwd: root,
  }))
    return Bun.file(join(root, f)).text();
  return "";
}
