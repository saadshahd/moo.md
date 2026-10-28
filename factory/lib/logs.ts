/**
 * Test output cut to its failures before the agent reads it, so a long run doesn't re-read
 * thousands of passing lines every turn.
 */

const TEST_COMMAND =
  /\b(?:(?:bun|npm|pnpm|yarn)\s+(?:run\s+)?test|vitest|jest|pytest|go\s+test|cargo\s+test)\b/;

const FAILURE =
  /\b(?:fail(?:ed|ure|ing)?|error|panic|assert(?:ion)?|expected|received|traceback)\b|✗|✕|×/i;

const KEEP_UNDER = 80;
const AROUND = 3;
const TAIL = 15;

export function isTestCommand(command: string): boolean {
  return TEST_COMMAND.test(command);
}

/** Line ranges kept, [from, to) each, merged and in order. */
function kept(lines: readonly string[]): [number, number][] {
  const end = lines.length;

  const wanted = [
    ...lines.flatMap((l, i): [number, number][] =>
      FAILURE.test(l) ? [[Math.max(0, i - AROUND), Math.min(end, i + AROUND + 1)]] : [],
    ),
    [Math.max(0, end - TAIL), end] satisfies [number, number],
  ].sort((a, b) => a[0] - b[0]);

  const out: [number, number][] = [];

  for (const [from, to] of wanted) {
    const last = out.at(-1);

    if (last !== undefined && from <= last[1]) last[1] = Math.max(last[1], to);
    else out.push([from, to]);
  }

  return out;
}

export function cutToFailures(text: string): string {
  const lines = text.split("\n");

  if (lines.length <= KEEP_UNDER || !lines.some((l) => FAILURE.test(l)))
    return text;

  return kept(lines)
    .flatMap(([from, to], i, all) => {
      const gap = from - (i === 0 ? 0 : all[i - 1]![1]);

      return [
        ...(gap > 0 ? [`… ${gap} passing lines cut by the factory …`] : []),
        ...lines.slice(from, to),
      ];
    })
    .join("\n");
}
