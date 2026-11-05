// Each demo page's two prompts against rule 2 of the demo plan: the moo-on
// pane types the moo-off words with only `/hope:<move> ` in front, or
// `/hope:compose ` on a chain page. No model: text only.
// Usage: check-prompts.mts
import { pages, promptMatch } from "./pages.mts";

let bad = 0;
for (const page of pages()) {
  const { ok, why } = promptMatch(page);
  if (!ok) bad++;
  console.log(`${page.slug}: ${ok ? "ok" : why}`);
}
if (bad) {
  console.error(`${bad} pages whose prompts break rule 2`);
  process.exit(1);
}
