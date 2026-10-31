import { describe, expect, test } from "claude-code/testing";
import { RULE, register } from "./reach.ts";

function compose(sections: { id: string; text: string; scope: string }[]) {
  const hooks: ((...a: any[]) => any)[] = [];
  register(((event: string, ...rest: any[]) => {
    if (event === "prompt.compose") hooks.push(rest[rest.length - 1]);
  }) as any);
  return hooks[0]({}, {}, async () => ({ sections }));
}

describe("reach", () => {
  test("adds the rule last, after the cache boundary, leaving the engine's sections as they were", async () => {
    const engine = [
      { id: "intro", text: "i", scope: "shared" },
      { id: "env", text: "e", scope: "session" },
    ];
    const { sections } = await compose(engine);
    expect(sections.slice(0, 2)).toEqual(engine);
    expect(sections[2]).toEqual({
      id: "hope:reach",
      text: RULE,
      scope: "session",
    });
  });
});
