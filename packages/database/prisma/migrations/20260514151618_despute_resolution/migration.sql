-- No-op (reordered): original statements altered tables/indexes created in later migrations
-- (AffiliatePartner, BillingDispute, MonthlyBillableSummary, ReactivationRequest, BackfillWindow).
-- Those objects are created in 20260515120000+ migrations with correct Prisma @updatedAt shape.
SELECT 1;
