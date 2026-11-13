export type MoveGroup = { heading: string; moves: string[] };

/** The Start pages (start/<name>.mdx) as one group, in the order a session
 * meets them. */
export const START_GROUP: MoveGroup = { heading: "Start", moves: ["intent", "shape", "consult", "compose"] };

/** The Moves menu's groups, in order: a short heading and its moves' page
 * names (moves/<name>.mdx). Every move page sits in exactly one group. */
export const MOVE_GROUPS: MoveGroup[] = [
  { heading: "The ask", moves: ["clarify", "elicit", "explain"] },
  { heading: "The bar", moves: ["deepen", "widen", "draft"] },
  { heading: "Rewrite", moves: ["reframe", "anchor", "reduce"] },
  { heading: "Angles", moves: ["inversion", "shift", "interrogate"] },
  { heading: "Hand off", moves: ["router", "target"] },
  { heading: "Evidence", moves: ["freeze", "judge"] },
];
