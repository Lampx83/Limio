-- CreateEnum
CREATE TYPE "GenerativeActivityType" AS ENUM ('summarizing', 'mapping', 'drawing', 'imagining', 'self_explaining', 'teaching', 'enacting');

-- CreateEnum
CREATE TYPE "AssessmentMode" AS ENUM ('instructor_graded', 'self_assessed', 'ai_assessed', 'peer_reviewed');

-- CreateEnum
CREATE TYPE "ResponseFormat" AS ENUM ('text', 'file', 'image', 'audio', 'video', 'concept_map', 'mixed');

-- AlterTable
ALTER TABLE "Assignment"
  ADD COLUMN "pedagogicalIntent" "GenerativeActivityType",
  ADD COLUMN "responseFormat"    "ResponseFormat" NOT NULL DEFAULT 'text',
  ADD COLUMN "assessmentModes"   "AssessmentMode"[] DEFAULT ARRAY['instructor_graded']::"AssessmentMode"[],
  ADD COLUMN "requireSelfRating" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireReflection" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "countsTowardGrade" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "AssignmentSubmission"
  ADD COLUMN "selfRating" INTEGER,
  ADD COLUMN "reflection" TEXT,
  ADD COLUMN "aiFeedback" JSONB;
