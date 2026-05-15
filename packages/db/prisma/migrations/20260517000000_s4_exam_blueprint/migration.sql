-- S4 — Blueprint Editor (Table of Specifications)
-- Adds ExamBlueprint 1:1 with Exam. No data backfill needed (new feature).

CREATE TABLE "ExamBlueprint" (
    "examId"     TEXT         NOT NULL,
    "lessonIds"  TEXT[]       NOT NULL DEFAULT '{}',
    "cells"      JSONB        NOT NULL DEFAULT '[]',
    "totalCount" INTEGER      NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamBlueprint_pkey" PRIMARY KEY ("examId")
);

ALTER TABLE "ExamBlueprint"
    ADD CONSTRAINT "ExamBlueprint_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "Exam"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
