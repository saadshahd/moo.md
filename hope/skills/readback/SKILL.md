---
name: readback
description: Have a fresh reader restate what the agent wrote, and fix the text where the restatement goes wrong. Use when the agent wrote text that a reader who never saw the chat will act on — an order for another agent, a work order, a memory, a Pad.
---

Give the reader exactly what the text's next reader will have: start a **hope:fresh-reader** agent with the Agent tool — fresh, never a fork — and pass the text alone, with no summary of the chat.

Compare its restatement with what you meant. Every difference counts against the text:

- It misread → rewrite the words it misread. The words stand only where the proof sat in what the reader could open — a line of the text, a file it points to; cite it. What the chat said is not proof.
- It guessed → settle the guess in the text. A gap the reader hit stays a gap, whatever the chat settled.
- Write in only what the real reader needs. A sentence that serves only this check is padding: leave it out.

The reader errored, stopped, or returned nothing → the check did not run. Say so; never pass the text as read.

Hand back the fixed text, and under it one line per change: the words misread or guessed at, and what the text says now. The restatement matched → say so in one line.

The text's reader saw the chat → not readback; stop.
