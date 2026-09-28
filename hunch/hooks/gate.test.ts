import { describe, expect, test } from "claude-code/testing";
import { heldReason, saysGo, unquoted, userWords } from "./gate.tsx";
import { cleanCard, latestCard } from "./tend.tsx";

// The user's words, as typed in real sessions this gate was measured on.
const SONG =
  "why is this a story? why can't we just make a song ... this is a song a bout a feeling not a place not a country";
const HARVEST =
  "harvest captures and reports only it doesn't create or build or solve";

const user = (text: string) => ({ role: "user", text });
const answered = (text: string) => ({
  role: "user",
  text: "",
  toolResults: [{ text }],
});

describe("user words", () => {
  test("typed messages and both forms of an AskUserQuestion answer", async () => {
    expect(
      userWords([
        user(SONG),
        answered('The user answered: "Goal?"="a feeling", "Done?"="I hum it"'),
        answered(
          'Your questions have been answered: "Done?"="it plays in suno". You can now continue',
        ),
      ]),
    ).toHaveLength(3);
  });
  test("an agent's return and other tool results are not the user's", async () => {
    expect(
      userWords([
        user(
          "<task-notification><result>done-check: tests pass</result></task-notification>",
        ),
        answered("file contents"),
        { role: "assistant", text: "the goal is a feeling" },
      ]),
    ).toEqual([]);
  });
});

describe("unquoted", () => {
  const words = [SONG, HARVEST];
  test("a quote found in the user's words passes, whatever its case, quote marks and closing stop", async () => {
    expect(
      unquoted(
        {
          goal: "“A song a bout a feeling not a place.”",
          done: "Harvest captures and reports only",
        },
        words,
      ),
    ).toEqual([]);
  });
  test("a reworded quote is held", async () => {
    expect(
      unquoted(
        {
          goal: "a feeling-driven song",
          done: "harvest captures and reports only",
        },
        words,
      ),
    ).toEqual(["goal"]);
  });
  test("a missing slot or card is held", async () => {
    expect(unquoted({ goal: "a song a bout a feeling" }, words)).toEqual([
      "done",
    ]);
    expect(unquoted(undefined, words)).toEqual(["goal", "done"]);
  });
  test("the reason names each missing slot and the way out", async () => {
    const r = heldReason(["done"]);
    expect(r).toContain("done (how they will tell it worked)");
    expect(r).not.toContain("goal (");
    expect(r).toContain('"go"');
  });
});

describe("said on the card", () => {
  test("kept from the newest block, empty slots dropped", async () => {
    const block = (json: string) => ({
      role: "assistant",
      text: `reply\n\`\`\`card\n${json}\n\`\`\`\n`,
    });
    expect(
      latestCard([
        block('{"said":{"goal":"a"}}'),
        block('{"said":{"goal":"b","done":""}}'),
      ]).said,
    ).toEqual({ goal: "b" });
    expect(cleanCard({ said: "a" }).said).toBeUndefined();
  });
});

describe("go", () => {
  test("a prompt that starts with go", async () => {
    expect(saysGo("go")).toBe(true);
    expect(saysGo("Go ahead")).toBe(true);
    expect(saysGo("good question, but")).toBe(false);
    expect(saysGo("let's go")).toBe(false);
  });
});
