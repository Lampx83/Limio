"use client";

import { useState } from "react";
import ExamMetaForm from "../../courses/[id]/exams/ExamMetaForm";

interface Course {
  id: string;
  title: string;
  slug: string;
}

interface Props {
  courses: Course[];
  initialCourseId: string;
}

function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/**
 * Cross-course "Create exam" hub form. Picks the target course first, then
 * delegates to the standard ExamMetaForm (which posts to
 * /api/courses/[id]/exams and redirects to the per-exam edit page).
 */
export default function NewExamForm({ courses, initialCourseId }: Props) {
  const [courseId, setCourseId] = useState(initialCourseId);
  const now = new Date();
  const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

  return (
    <div className="space-y-4">
      <div className="rounded border border-default bg-white p-4">
        <label className="block text-sm font-medium">Khóa học</label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-faint">
          Bài thi sẽ chỉ hiển thị cho học viên đã đăng ký khoá này.
        </p>
      </div>

      <ExamMetaForm
        key={courseId}
        mode="create"
        courseId={courseId}
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
    </div>
  );
}
