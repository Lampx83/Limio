"use client";

import { useState, useEffect, useMemo } from "react";
import CourseSelector from "./CourseSelector";
import ManualStudentInput from "./ManualStudentInput";
import TeachingToolsWrapper from "./TeachingToolsWrapper";
import { apiUrl } from "@/lib/apiUrl";

export interface StudentItem {
  name: string;
  id: string | null; // null for manual input
}

interface Course {
  id: string;
  title: string;
  _count: { enrollments: number };
}

interface TeachingToolsClientProps {
  courses: Course[];
}

export default function TeachingToolsClient({
  courses,
}: TeachingToolsClientProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [manualStudentText, setManualStudentText] = useState("");
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCourseEnrollmentCount, setSelectedCourseEnrollmentCount] = useState(0);

  // Fetch enrollments when course selected
  useEffect(() => {
    if (!selectedCourseId) {
      setEnrollments([]);
      setSelectedCourseEnrollmentCount(0);
      return;
    }

    // Get the selected course object to get its enrollment count
    const selectedCourse = courses.find((c) => c.id === selectedCourseId);
    if (selectedCourse) {
      setSelectedCourseEnrollmentCount(selectedCourse._count.enrollments);
    }

    setIsLoading(true);
    fetchEnrollments(selectedCourseId);
  }, [selectedCourseId, courses]);

  const fetchEnrollments = async (courseId: string) => {
    try {
      console.log("[TeachingTools] Fetching enrollments for courseId:", courseId);
      const res = await fetch(apiUrl(`/api/courses/${courseId}/enrollments`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      console.log("[TeachingTools] API Response status:", res.status, res.statusText);

      const data = await res.json();
      console.log("[TeachingTools] API Response data:", data);

      if (res.ok) {
        console.log("[TeachingTools] SUCCESS - Got", data.length, "enrollments");
        setEnrollments(data);
      } else {
        console.error("[TeachingTools] API returned error status", res.status);
        console.error("[TeachingTools] Error details:", data);
      }
    } catch (err) {
      console.error("[TeachingTools] Network error fetching enrollments:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const studentList = useMemo(() => {
    if (selectedCourseId && enrollments.length > 0) {
      // Course mode: use fetched enrollments
      return enrollments.map((e: any) => ({
        name: e.user.displayName || e.user.email,
        id: e.userId,
      }));
    } else if (selectedCourseId && enrollments.length === 0 && selectedCourseEnrollmentCount > 0) {
      // Fallback: course has students but API fetch failed - create placeholder list
      console.warn(
        `[TeachingTools] API returned 0 enrollments but course has ${selectedCourseEnrollmentCount} students. Creating placeholder list.`
      );
      return Array.from({ length: selectedCourseEnrollmentCount }, (_, i) => ({
        name: `Sinh viên ${i + 1}`,
        id: `placeholder-${i}`,
      }));
    } else if (!selectedCourseId && manualStudentText.trim()) {
      // Manual mode: parse textarea
      return manualStudentText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((name, idx) => ({
          name,
          id: `manual-${idx}`,
        }));
    }
    return [];
  }, [selectedCourseId, enrollments, manualStudentText, selectedCourseEnrollmentCount]);

  return (
    <div className="space-y-8">
      {/* Teaching Tools Section */}
      <TeachingToolsWrapper studentList={studentList} />

      {/* Course Selector Section - Only for Random Picker & Grouping Tool */}
      <div className="rounded-2xl border-2 border-accent-200 bg-[rgb(var(--surface))] p-6 shadow-card">
        <h2 className="text-lg font-semibold mb-4">
          Danh sách sinh viên (cho Chọn Ngẫu Nhiên & Phân Nhóm)
        </h2>
        <CourseSelector
          courses={courses}
          selectedCourseId={selectedCourseId}
          onSelectCourse={setSelectedCourseId}
          enrollmentCount={enrollments.length}
          isLoading={isLoading}
        />

        {!selectedCourseId && (
          <ManualStudentInput
            value={manualStudentText}
            onChange={setManualStudentText}
            studentCount={
              manualStudentText
                .split("\n")
                .filter((line) => line.trim().length > 0).length
            }
          />
        )}

        {studentList.length > 0 && (
          <div className="mt-6 rounded-lg border border-token p-4 bg-[rgb(var(--surface-muted))]">
            <p className="text-sm font-medium text-muted mb-2">
              {studentList.length} sinh viên sẽ được sử dụng cho các công cụ cần danh sách
            </p>
            <div className="flex flex-wrap gap-2">
              {studentList.slice(0, 10).map((student, i) => (
                <span
                  key={i}
                  className="inline-block rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700"
                >
                  {student.name}
                </span>
              ))}
              {studentList.length > 10 && (
                <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                  +{studentList.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
