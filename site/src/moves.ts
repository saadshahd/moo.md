/** The moves a demo page's strip shows: a chain page's, in order, or a move
 * page's own, named by its page. */
export const stripMoves = ({ id, data }: { id: string; data: { moves?: string[] } }) =>
  data.moves ?? [id.split("/").pop()!];
