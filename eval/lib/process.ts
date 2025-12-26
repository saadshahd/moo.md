import type { ProcessResult, Result } from "./types";
import { Ok, Err } from "./types";

export async function spawnWithTimeout(
  args: string[],
  timeout: number,
): Promise<Result<ProcessResult, string>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  const start = performance.now();

  try {
    const proc = Bun.spawn(args, {
      signal: controller.signal,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    clearTimeout(timeoutId);

    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);

    const duration = (performance.now() - start) / 1000;
    return Ok({ exitCode, stdout, stderr, duration });
  } catch (e) {
    clearTimeout(timeoutId);
    return Err(e instanceof Error ? e.message : String(e));
  }
}

export const buildClaudeArgs = (
  prompt: string,
  pluginDir: string,
  model?: string,
): string[] => {
  const args = [
    "claude",
    "-p",
    prompt,
    "--plugin-dir",
    `./${pluginDir}`,
    "--setting-sources",
    "project",
    "--output-format",
    "json",
  ];
  if (model) {
    args.push("--model", model);
  }
  return args;
};

export const buildSimpleClaudeArgs = (prompt: string): string[] => [
  "claude",
  "-p",
  prompt,
  "--output-format",
  "json",
];
