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

interface Section {
  id: string;
  name: string;
  enrolledCount: number;
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
  const [mode, setMode] = useState<Mode>("manual");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [manualText, setManualText] = useState("");
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleSelectCourse = useCallback((courseId: string | null) => {
    setSelectedCourseId(courseId);
    setSelectedSectionId(null);
  }, []);

  useEffect(() => {
    if (mode !== "course" || !selectedCourseId) {
      setSections([]);
      return;
    }
    let cancelled = false;
    fetch(apiUrl(`/api/courses/${selectedCourseId}/sections`))
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data?.sections)) setSections(data.sections);
      })
      .catch((err) => console.error("[StudentListGate] fetch sections error", err));
    return () => {
      cancelled = true;
    };
  }, [mode, selectedCourseId]);

  useEffect(() => {
    if (mode !== "course" || !selectedCourseId) {
      setEnrollments([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    const url = selectedSectionId
      ? `/api/courses/${selectedCourseId}/enrollments?sectionId=${selectedSectionId}`
      : `/api/courses/${selectedCourseId}/enrollments`;
    fetch(apiUrl(url))
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
  }, [mode, selectedCourseId, selectedSectionId]);

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
        <div className="flex items-center justify-between rounded-xl border border-token bg-[rgb(var(--surface-muted))] px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">{studentList.length} sinh viên</span>{" "}
            <span className="text-muted">
              (
              {mode === "course"
                ? selectedSectionId
                  ? `lớp ${sections.find((s) => s.id === selectedSectionId)?.name ?? ""}`
                  : "từ khóa học"
                : "nhập thủ công"}
              )
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
    <div className="tool-panel space-y-5">
      <div>
        <h2 className="tool-title">{title}</h2>
        {description && <p className="tool-subtitle mt-1">{description}</p>}
      </div>

      <div className="tool-segmented">
        <button
          type="button"
          onClick={() => setMode("manual")}
          aria-pressed={mode === "manual"}
        >
          Nhập thủ công
        </button>
        <button
          type="button"
          onClick={() => setMode("course")}
          aria-pressed={mode === "course"}
        >
          Chọn từ khóa học
        </button>
      </div>

      {mode === "course" ? (
        <div className="space-y-4">
          <CourseSelector
            courses={courses}
            selectedCourseId={selectedCourseId}
            onSelectCourse={handleSelectCourse}
            enrollmentCount={enrollments.length}
            isLoading={isLoading}
          />
          {selectedCourseId && sections.length > 0 && (
            <div>
              <label className="label mb-2 block font-medium">Chọn lớp (tuỳ chọn)</label>
              <select
                value={selectedSectionId || ""}
                onChange={(e) => setSelectedSectionId(e.target.value || null)}
                disabled={isLoading}
                className="input w-full"
              >
                <option value="">Tất cả học viên trong khóa học</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name} ({section.enrolledCount} học viên)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
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
          className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Tiếp tục
        </button>
      </div>
    </div>
  );
}
