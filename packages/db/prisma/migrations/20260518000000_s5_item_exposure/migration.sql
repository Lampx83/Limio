-- S5 — Item Exposure Tracking
-- Adds exposureCount + lastSampledAt to BankQuestion so instructors can
-- see how many times a question was sampled for a per_attempt random section.

ALTER TABLE "BankQuestion"
    ADD COLUMN "exposureCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lastSampledAt" TIMESTAMP(3);
