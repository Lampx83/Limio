-- B9 — SSMMD instrumentation.
--
-- Every delivered feedback records its own analytic coordinates so the corpus
-- can be described without re-reading the text. All columns are nullable: rows
-- delivered before B9 were never coded, and must not be made to look as if they
-- were. The backfill script codes what it can from stored data and marks those
-- rows `generationContext.codedRetroactively = true`.

CREATE TYPE "FeedbackLevel" AS ENUM ('task', 'process', 'self_regulation', 'self');
CREATE TYPE "FeedbackElaboration" AS ENUM ('kr', 'kcr', 'kh', 'km', 'elaborated');
CREATE TYPE "FeedbackSourceKind" AS ENUM ('rule_template', 'misconception', 'bkt_state', 'llm', 'hybrid');

ALTER TABLE "FeedbackTemplate"
  ADD COLUMN "level" "FeedbackLevel",
  ADD COLUMN "elaboration" "FeedbackElaboration";

ALTER TABLE "FeedbackDelivery"
  ADD COLUMN "level" "FeedbackLevel",
  ADD COLUMN "levels" JSONB,
  ADD COLUMN "elaboration" "FeedbackElaboration",
  ADD COLUMN "sourceKind" "FeedbackSourceKind",
  ADD COLUMN "generationContext" JSONB;

CREATE INDEX "FeedbackDelivery_level_deliveredAt_idx"
  ON "FeedbackDelivery" ("level", "deliveredAt");
