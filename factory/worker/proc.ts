import type { Run } from "../lib/github.ts";

export const run: Run = async (argv, opts) => {
  const p = Bun.spawn([...argv], {
    cwd: opts?.cwd,
    stdin: opts?.stdin === undefined ? "ignore" : new TextEncoder().encode(opts.stdin),
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
