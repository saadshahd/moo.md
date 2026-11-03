/** The Moves menu's groups, in order: a short heading and its moves' page
 * names (moves/<name>.mdx). Every move page sits in exactly one group. */
export const MOVE_GROUPS: { heading: string; moves: string[] }[] = [
  { heading: "The ask", moves: ["clarify", "elicit", "explain"] },
  { heading: "The bar", moves: ["deepen", "widen", "draft"] },
  { heading: "Rewrite", moves: ["reframe", "anchor", "reduce"] },
  { heading: "Angles", moves: ["inversion", "shift", "interrogate"] },
  { heading: "Hand off", moves: ["router", "target"] },
  { heading: "Evidence", moves: ["freeze", "judge"] },
];
