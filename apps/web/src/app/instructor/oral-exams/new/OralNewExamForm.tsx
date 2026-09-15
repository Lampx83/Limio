"use client";

import { useState } from "react";
import ExamMetaForm from "../../courses/[id]/exams/ExamMetaForm";

interface Course {
  id: string;
  title: string;
}

function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/** A6.5 — Tạo đề vấn đáp AI. Kind cố định = "oral", không cho chọn — điểm
 * vào (menu Vấn đáp AI) đã quyết định điều đó. */
export default function OralNewExamForm({
  courses,
  initialCourseId,
}: {
  courses: Course[];
  /** "" = đề độc lập, không gắn khoá học nào. */
  initialCourseId: string;
}) {
  const [courseIdRaw, setCourseIdRaw] = useState(initialCourseId);
  const courseId = courseIdRaw || null;
  const now = new Date();
  const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60_000);

  return (
    <div className="space-y-4">
      <div className="rounded border border-default bg-white p-4">
        <label className="block text-sm font-medium">Khoá học (tuỳ chọn)</label>
        <select
          value={courseIdRaw}
          onChange={(e) => setCourseIdRaw(e.target.value)}
          className="mt-1 w-full rounded border border-default px-3 py-2 text-sm"
        >
          <option value="">Không gắn khoá học (đề độc lập)</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-faint">
          {courseId
            ? "Buổi vấn đáp sẽ chỉ hiển thị cho học viên đã đăng ký khoá này."
            : "Đề độc lập — sinh viên vào thi hoàn toàn qua mã/link mời, không qua ghi danh khoá học."}
        </p>
      </div>

      <ExamMetaForm
        key={courseIdRaw}
        mode="create"
        courseId={courseId}
        fixedKind="oral"
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
          answerMode: "text",
        }}
      />
    </div>
  );
}
