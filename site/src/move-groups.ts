/** The Moves menu's groups, in order: a short heading and its moves' page
 * names (moves/<name>.mdx). Every move page sits in exactly one group. */
export const MOVE_GROUPS: { heading: string; moves: string[] }[] = [
  { heading: "The ask", moves: ["clarify", "elicit", "explain", "interrogate"] },
  { heading: "Evidence", moves: ["freeze", "judge"] },
  { heading: "Angles", moves: ["inversion", "shift"] },
  { heading: "The bar", moves: ["deepen", "widen", "draft"] },
  { heading: "Rewrite", moves: ["reframe", "anchor", "reduce"] },
  { heading: "Hand off", moves: ["router", "target"] },
];
