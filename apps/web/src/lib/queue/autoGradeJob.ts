import type { Job } from "bullmq";
import { applyAutoGradingForAttempt } from "@feedbackme/core-lms";
import { getAutoGradeQueue, QUEUE_NAMES } from "./index";

// Tintin — BullMQ job that runs auto-grading for a submitted exam attempt.
// API submit/force-submit/cron auto-submit routes enqueue this job after
// marking the attempt as submitted. The job is idempotent (the core-lms
// helper skips already-graded attempts) so retries are safe.

export type AutoGradeJobData = {
  attemptId: string;
};

export type AutoGradeJobResult = {
  attemptId: string;
  autoScore: number;
  fullyGraded: boolean;
  status: string;
};

export async function enqueueAutoGrade(
  attemptId: string,
): Promise<string> {
  // jobId per-attempt — duplicate enqueues for the same attempt coalesce so
  // a flaky retry from the cron tick can't double-grade.
  const job = await getAutoGradeQueue().add(
    "grade",
    { attemptId },
    { jobId: `grade:${attemptId}` },
  );
  return job.id ?? "";
}

export async function processAutoGradeJob(
  job: Job<AutoGradeJobData, AutoGradeJobResult>,
): Promise<AutoGradeJobResult> {
  const { attemptId } = job.data;
  const r = await applyAutoGradingForAttempt(attemptId);
  return {
    attemptId,
    autoScore: r.autoScore,
    fullyGraded: r.fullyGraded,
    status: r.status,
  };
}

export const AUTO_GRADE_QUEUE = QUEUE_NAMES.autoGrade;
