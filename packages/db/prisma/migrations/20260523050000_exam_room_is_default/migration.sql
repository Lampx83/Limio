-- Mark one room per ExamSession as the default destination for candidates who
-- join via open_code without entering a room code.
ALTER TABLE "ExamRoom" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Partial unique: at most 1 default room per session. Multiple non-default
-- rows allowed because the predicate filters them out.
CREATE UNIQUE INDEX "ExamRoom_sessionId_isDefault_key"
  ON "ExamRoom"("sessionId")
  WHERE "isDefault" = true;

-- Backfill: pick the lowest-orderIndex room of each session as default.
UPDATE "ExamRoom" SET "isDefault" = true
WHERE "id" IN (
  SELECT DISTINCT ON ("sessionId") "id"
  FROM "ExamRoom"
  ORDER BY "sessionId", "orderIndex" ASC, "createdAt" ASC
);
