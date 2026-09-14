"use client";

import ExamMetaForm from "../../courses/[id]/exams/ExamMetaForm";

interface Props {
  courseId: string;
}

function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/**
 * Cross-course "Create exam" hub form — delegates to the standard
 * ExamMetaForm (which posts to /api/courses/[id]/exams and redirects to the
 * per-exam edit page). Khoá học được chọn ở header ExamWizard, không lặp lại
 * selector ở đây.
 */
export default function NewExamForm({ courseId }: Props) {
  const now = new Date();
  const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

  return (
    <ExamMetaForm
      key={courseId}
      mode="create"
      courseId={courseId}
      fixedKind="written"
      initial={{
        title: "",
        description: "",
        durationMin: 60,
        openAt: toLocalInput(now),
        closeAt: toLocalInput(inWeek),
        attemptPolicy: "single",
        gradingMode: "hybrid",
        proctoringLevel: "basic",
        shuffleQuestions: true,
        shuffleOptions: true,
        showResultsAfterSubmit: true,
        purpose: "assessment",
      }}
    />
  );
}
