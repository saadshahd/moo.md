type Empty = { s: { slotKey: string }; declIndex: number };

export const groupEmptiesByBoundary = (
  empties: Empty[],
  boundaryAt: (declIndex: number) => number,
): Map<number, { slotKey: string }[]> => {
  const grouped = new Map<number, { slotKey: string }[]>();
  for (const { s, declIndex } of empties) {
    const b = boundaryAt(declIndex);
    const list = grouped.get(b) ?? [];
    list.push({ slotKey: s.slotKey });
    grouped.set(b, list);
  }
  return grouped;
};
