"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import CourseSelector from "./CourseSelector";
import ManualStudentInput from "./ManualStudentInput";
import { apiUrl } from "@/lib/apiUrl";
import type { StudentItem } from "./TeachingToolsClient";

interface Course {
  id: string;
  title: string;
  _count: { enrollments: number };
}

interface StudentListGateProps {
  courses: Course[];
  title: string;
  description?: string;
  children: (studentList: StudentItem[], reset: () => void) => React.ReactNode;
}

type Mode = "course" | "manual";

export default function StudentListGate({
  courses,
  title,
  description,
  children,
}: StudentListGateProps) {
  const [mode, setMode] = useState<Mode>("course");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (mode !== "course" || !selectedCourseId) {
      setEnrollments([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    fetch(apiUrl(`/api/courses/${selectedCourseId}/enrollments`))
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) setEnrollments(data);
      })
      .catch((err) => console.error("[StudentListGate] fetch error", err))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [mode, selectedCourseId]);

  const studentList = useMemo<StudentItem[]>(() => {
    if (mode === "course" && enrollments.length > 0) {
      return enrollments.map((e: any) => ({
        name: e.user.displayName || e.user.email,
        id: e.userId,
      }));
    }
    if (mode === "manual" && manualText.trim()) {
      return manualText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((name, idx) => ({ name, id: `manual-${idx}` }));
    }
    return [];
  }, [mode, enrollments, manualText]);

  const reset = useCallback(() => {
    setConfirmed(false);
  }, []);

  const canConfirm = studentList.length > 0;

  if (confirmed && canConfirm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-token bg-[rgb(var(--surface-muted))] px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">{studentList.length} sinh viên</span>{" "}
            <span className="text-muted">
              ({mode === "course" ? "từ khóa học" : "nhập thủ công"})
            </span>
          </p>
          <button
            type="button"
            onClick={reset}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Đổi danh sách
          </button>
        </div>
        {children(studentList, reset)}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-accent-200 bg-[rgb(var(--surface))] p-6 shadow-card space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("course")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
            mode === "course"
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-token text-muted hover:border-accent-300"
          }`}
        >
          Chọn từ khóa học
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
            mode === "manual"
              ? "border-brand-500 bg-brand-50 text-brand-700"
              : "border-token text-muted hover:border-accent-300"
          }`}
        >
          Nhập thủ công
        </button>
      </div>

      {mode === "course" ? (
        <CourseSelector
          courses={courses}
          selectedCourseId={selectedCourseId}
          onSelectCourse={setSelectedCourseId}
          enrollmentCount={enrollments.length}
          isLoading={isLoading}
        />
      ) : (
        <ManualStudentInput
          value={manualText}
          onChange={setManualText}
          studentCount={studentList.length}
        />
      )}

      <div className="flex items-center justify-end gap-3 border-t border-token pt-4">
        <span className="text-sm text-muted">
          {studentList.length > 0
            ? `${studentList.length} sinh viên sẵn sàng`
            : "Chưa có sinh viên"}
        </span>
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          disabled={!canConfirm}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Tiếp tục
        </button>
      </div>
    </div>
  );
}
