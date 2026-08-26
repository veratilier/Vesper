export type MergeableCodexMessage = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  metadata?: { itemId?: string; turnId?: string };
};

export function mergeCodexMessages<T extends MergeableCodexMessage>(...groups: T[][]): T[] {
  const merged: Array<T | undefined> = [];
  const byId = new Map<string, number>();
  const byItemId = new Map<string, number>();
  const byTurnContent = new Map<string, number>();
  const semanticKey = (item: T) => item.metadata?.turnId
    ? `${item.metadata.turnId}\u0000${item.role}\u0000${item.content}`
    : "";
  const indexMessage = (item: T, index: number) => {
    if (item.id) byId.set(item.id, index);
    if (item.metadata?.itemId) byItemId.set(item.metadata.itemId, index);
    const semantic = semanticKey(item);
    if (semantic) byTurnContent.set(semantic, index);
  };

  for (const item of groups.flat()) {
    const matches = new Set<number>();
    const idMatch = item.id ? byId.get(item.id) : undefined;
    const itemMatch = item.metadata?.itemId ? byItemId.get(item.metadata.itemId) : undefined;
    const semantic = semanticKey(item);
    const semanticMatch = semantic ? byTurnContent.get(semantic) : undefined;
    if (idMatch !== undefined) matches.add(idMatch);
    if (itemMatch !== undefined) matches.add(itemMatch);
    if (semanticMatch !== undefined) matches.add(semanticMatch);

    const matchIndexes = [...matches].filter((index) => merged[index]);
    if (!matchIndexes.length) {
      const index = merged.length;
      merged.push(item);
      indexMessage(item, index);
      continue;
    }

    const targetIndex = Math.min(...matchIndexes);
    const original = merged[targetIndex]!;
    let next = original;
    for (const index of matchIndexes) {
      if (index === targetIndex) continue;
      const duplicate = merged[index];
      if (!duplicate) continue;
      next = { ...next, ...duplicate, id: next.id || duplicate.id, createdAt: next.createdAt || duplicate.createdAt, metadata: { ...next.metadata, ...duplicate.metadata } } as T;
      indexMessage(duplicate, targetIndex);
      merged[index] = undefined;
    }
    next = {
      ...next,
      ...item,
      id: original.id || item.id,
      createdAt: original.createdAt || item.createdAt,
      metadata: { ...next.metadata, ...item.metadata },
    } as T;
    merged[targetIndex] = next;
    indexMessage(item, targetIndex);
    indexMessage(next, targetIndex);
  }

  return merged.filter((item): item is T => Boolean(item)).sort((left, right) =>
    Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id));
}
