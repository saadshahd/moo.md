type Source = { parentId: string; slotKey: string; index: number };

const adjustSameSlot = ({
  index,
  source,
  parentId,
  slotKey,
}: {
  index: number;
  source: Source;
  parentId: string;
  slotKey: string;
}): number | null => {
  if (source.parentId !== parentId || source.slotKey !== slotKey) return index;
  const adjusted = index > source.index ? index - 1 : index;
  return adjusted === source.index ? null : adjusted;
};

export const resolveDropIndex = (args: {
  index: number;
  source: Source;
  elementId: string;
  slotKey: string;
}): number | null => {
  const { index, source, elementId, slotKey } = args;
  const adjusted = adjustSameSlot({ index, source, parentId: elementId, slotKey });
  if (adjusted === null) return null;
  return adjusted;
};
