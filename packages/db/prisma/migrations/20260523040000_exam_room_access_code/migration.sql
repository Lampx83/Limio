-- Add 4-char accessCode to ExamRoom for self-join room assignment in open_code exams.
-- Nullable: existing rooms stay null (backwards compatible). New rooms get a code
-- via createExamRoom() service.
ALTER TABLE "ExamRoom" ADD COLUMN "accessCode" VARCHAR(4);

-- Unique per session (NULLs allowed multiple times by Postgres default).
CREATE UNIQUE INDEX "ExamRoom_sessionId_accessCode_key"
  ON "ExamRoom"("sessionId", "accessCode");
