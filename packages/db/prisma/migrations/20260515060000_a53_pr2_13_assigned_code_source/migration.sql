-- A5.3 PR2.13 — Optional MSSV-as-accessCode cho assigned_code.

CREATE TYPE "AssignedCodeSource" AS ENUM ('random', 'student_code');

ALTER TABLE "Exam"
  ADD COLUMN "assignedCodeSource" "AssignedCodeSource" NOT NULL DEFAULT 'random';
