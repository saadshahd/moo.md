/** The `call` flags; `parseArgs` in `worker/cli.ts` reads them and `usage` shows each with its hint. */
export const CALL = {
  choice: { type: "string", hint: "what was open" },
  picked: { type: "string", hint: "what you chose" },
  other: { type: "string", multiple: true, hint: "an option you did not pick" },
  why: { type: "string", hint: "why this one" },
  undo: { type: "string", hint: "what reversing it takes" },
} as const;

/** How a run is told to type each command, `cli` being how it starts `worker/cli.ts`. */
export function usage(cli: string) {
  const flags = Object.entries(CALL).map(([k, o]) => `--${k} "<${o.hint}>"`).join(" ");

  return {
    plan: `${cli} plan`,
    call: `${cli} call ${flags}`,
    handoff: `${cli} handoff`,
    pr: `${cli} pr`,
    stuck: `${cli} stuck "<the reason, in one line>"`,
  };
}
