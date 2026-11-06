import { describe, expect, test } from "claude-code/testing";
import { RULE, register } from "./reach.ts";

function submit(
  read: { role: string; content: { type: string; text?: string }[] }[],
  context?: string[],
) {
  const hooks: ((...a: any[]) => any)[] = [];
  register(((event: string, ...rest: any[]) => {
    if (event === "prompt.submit") hooks.push(rest[rest.length - 1]);
  }) as any);
  const $ = { session: { messages: async () => read } };
  return hooks[0]($, { text: "go", context }, async (e: unknown) => e);
}

describe("reach", () => {
  test("adds the rule beside a session's first prompt, after the context other hooks attached", async () => {
    const e = await submit([], ["mine"]);
    expect(e.context).toEqual(["mine", RULE]);
  });

  test("adds nothing while the conversation the model reads holds the rule", async () => {
    const e = await submit([
      {
        role: "user",
        content: [
          { type: "text", text: "go" },
          {
            type: "text",
            text: `<system-reminder>\n${RULE}\n</system-reminder>`,
          },
        ],
      },
      { role: "assistant", content: [{ type: "text", text: "done" }] },
    ]);
    expect(e.context).toBeUndefined();
  });

  test("adds it again once a compaction's summary took the place of the prompt that carried it", async () => {
    const e = await submit([
      {
        role: "user",
        content: [{ type: "text", text: "Summary: the user asked for a fix." }],
      },
    ]);
    expect(e.context).toEqual([RULE]);
  });
});
