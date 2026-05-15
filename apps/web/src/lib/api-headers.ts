/**
 * Institution portal calls the API with JWT + optional X-Entity-ID.
 * Users with entityScope ALL may choose "All entities" to omit X-Entity-ID so
 * routes that honor the header (e.g. middleware `req.entity`) stay institution-wide.
 */
export function appendOptionalEntityHeader(
  headers: Record<string, string>,
  user: { entityId?: string; omitEntityHeader?: boolean } | undefined,
): void {
  if (!user?.entityId?.trim()) {
    return;
  }
  if (user.omitEntityHeader) {
    return;
  }
  headers['X-Entity-ID'] = user.entityId.trim();
}
