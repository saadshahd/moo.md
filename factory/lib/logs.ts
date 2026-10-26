// Test output cut to its failures before the agent reads it, so a long run doesn't re-read
// thousands of passing lines every turn.

const TEST_COMMAND =
  /\b(?:(?:bun|npm|pnpm|yarn)\s+(?:run\s+)?test|vitest|jest|pytest|go\s+test|cargo\s+test)\b/;

const FAILURE =
  /\b(?:fail(?:ed|ure|ing)?|error|panic|assert(?:ion)?|expected|received|traceback)\b|✗|✕|×/i;

const KEEP_UNDER = 80;
const AROUND = 3;
const TAIL = 15;

/** Whether `command` runs a test suite. */
export function isTestCommand(command: string): boolean {
  return TEST_COMMAND.test(command);
}

/**
 * `text` with only the lines near a failure and the closing summary, a count of what was cut in
 * their place; whole when it is short or has no failure to show.
 */
export function cutToFailures(text: string): string {
  const lines = text.split("\n");

  if (lines.length <= KEEP_UNDER) return text;
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (!FAILURE.test(l)) return;

    for (let j = i - AROUND; j <= i + AROUND; j++) keep.add(j);
  });

  if (keep.size === 0) return text;

  for (let j = lines.length - TAIL; j < lines.length; j++) keep.add(j);
  const out: string[] = [];
  let cut = 0;
  lines.forEach((l, i) => {
    if (keep.has(i)) {
      if (cut > 0) out.push(`… ${cut} passing lines cut by the factory …`);
      cut = 0;
      out.push(l);
    } else cut++;
  });

  return out.join("\n");
}
