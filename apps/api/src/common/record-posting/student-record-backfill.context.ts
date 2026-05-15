/** Attached to `req` when {@link StudentRecordPostingGuard} allows a write via an active backfill window. */
export interface StudentRecordBackfillContext {
  isBackfilled: true;
  backfillRequestId: string;
  backfillWindowId: string;
}
