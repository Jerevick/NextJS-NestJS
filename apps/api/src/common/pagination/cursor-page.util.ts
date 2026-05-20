export function normalizePageLimit(
  limit: number | undefined,
  defaultLimit = 20,
  max = 100,
): number {
  if (limit === undefined || Number.isNaN(limit)) {
    return defaultLimit;
  }
  return Math.min(max, Math.max(1, Math.floor(limit)));
}

/** Split `limit + 1` rows into a page and optional next cursor (id of last row). */
export function sliceCursorPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): { data: T[]; nextCursor?: string } {
  const data = [...rows];
  let nextCursor: string | undefined;
  if (data.length > limit) {
    const last = data.pop();
    nextCursor = last?.id;
  }
  return { data, nextCursor };
}

export function prismaCursorArgs(cursor: string | undefined): {
  skip?: number;
  cursor?: { id: string };
} {
  if (!cursor?.trim()) {
    return {};
  }
  return { skip: 1, cursor: { id: cursor.trim() } };
}
