/** The Moves menu's groups, in order: a short heading and its moves' page
 * names (moves/<name>.mdx). Every move page sits in exactly one group. */
export const MOVE_GROUPS: { heading: string; moves: string[] }[] = [
  { heading: "When the ask is fuzzy", moves: ["clarify", "elicit", "reframe", "explain"] },
  { heading: "Before you commit", moves: ["interrogate", "judge", "inversion", "shift", "draft"] },
  { heading: "To hold the bar", moves: ["deepen", "widen", "anchor", "target", "freeze"] },
  { heading: "To hand off or cut", moves: ["router", "reduce"] },
];
