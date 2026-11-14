-- Đề thi dạng Khảo sát (docs/tieu-chi/de-thi-khao-sat.md).
ALTER TYPE "ExamPurpose" ADD VALUE IF NOT EXISTS 'survey';
ALTER TYPE "ExamQuestionType" ADD VALUE IF NOT EXISTS 'slider';

CREATE TYPE "SurveyPhase" AS ENUM ('pre', 'post');

ALTER TABLE "ExamPassage" ADD COLUMN "surveyPhase" "SurveyPhase";
ALTER TABLE "ExamSchedule" ADD COLUMN "surveyPhase" "SurveyPhase";
