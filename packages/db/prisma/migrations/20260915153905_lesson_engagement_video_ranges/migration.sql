-- Video watch detail: real watched segments + last known playback position,
-- additive alongside the existing high-water-mark maxVideoPct (untouched,
-- still drives lesson-completion — this migration changes zero behaviour,
-- only adds descriptive columns for reporting).
ALTER TABLE "LessonEngagement" ADD COLUMN "videoRanges" JSONB;
ALTER TABLE "LessonEngagement" ADD COLUMN "lastVideoPositionSec" INTEGER;
