declare global {
  namespace Express {
    interface Request {
      institution?: {
        id: string;
        slug: string;
        name: string;
        status: string;
      };
      /** Resolved from `X-Entity-ID` + institution (optional; cached in Redis). */
      entity?: {
        id: string;
        code: string;
        name: string;
        status: string;
      };
      /** Set by {@link StudentRecordPostingGuard} when a write is allowed under an active backfill window. */
      backfillContext?: {
        isBackfilled: true;
        backfillRequestId: string;
        backfillWindowId: string;
      };
    }
  }
}

export {};
