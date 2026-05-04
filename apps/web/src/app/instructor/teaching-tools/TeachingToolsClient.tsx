"use client";

import { useEffect, useMemo, useState } from "react";
import CourseSelector from "./CourseSelector";
import ManualStudentInput from "./ManualStudentInput";
import TeachingToolsWrapper from "./TeachingToolsWrapper";

interface StudentItem {
  name: string;
  id: string | null;
}

interface Course {
  id: string;
  title: string;
  _count: {
    enrollments: number;
  };
}

interface Enrollment {
  userId: string;
  user: {
    displayName: string | null;
    email: string;
  };
}

interface TeachingToolsClientProps {
  courses: Course[];
}

export default function TeachingToolsClient({
  courses,
}: TeachingToolsClientProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [manualStudentText, setManualStudentText] = useState("");
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState(false);

  // Fetch enrollments when course selected
  useEffect(() => {
    if (!selectedCourseId) {
      setEnrollments([]);
      return;
    }

    const fetchEnrollments = async () => {
      setIsLoadingEnrollments(true);
      try {
        const res = await fetch(
          `/api/instructor/teaching-tools/enrollments?courseId=${selectedCourseId}`
        );
        if (res.ok) {
          const data = await res.json();
          setEnrollments(data.enrollments);
        }
      } catch (err) {
        console.error("Failed to fetch enrollments:", err);
      } finally {
        setIsLoadingEnrollments(false);
      }
    };

    fetchEnrollments();
  }, [selectedCourseId]);

  const studentList = useMemo(() => {
    if (selectedCourseId && enrollments.length > 0) {
      // Course mode: use fetched enrollments
      return enrollments.map((e) => ({
        name: e.user.displayName || e.user.email || "Unknown",
        id: e.userId,
      }));
    } else if (!selectedCourseId && manualStudentText.trim()) {
      // Manual mode: parse textarea
      return manualStudentText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((name) => ({
          name,
          id: null,
        }));
    }
    return [];
  }, [selectedCourseId, enrollments, manualStudentText]);

  return (
    <div className="space-y-12">
      {/* Tools Section - Always show tools */}
      <TeachingToolsWrapper studentList={studentList} />

      {/* Selector Section - At the bottom */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Cấu Hình Danh Sách Sinh Viên
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Tùy chọn này cho phép bạn sử dụng các công cụ cần danh sách sinh viên
          </p>
        </div>

        <CourseSelector
          courses={courses}
          selectedCourseId={selectedCourseId}
          onSelectCourse={setSelectedCourseId}
          enrollmentCount={enrollments.length}
          isLoading={isLoadingEnrollments}
        />

        {!selectedCourseId && (
          <ManualStudentInput
            value={manualStudentText}
            onChange={setManualStudentText}
            studentCount={studentList.length}
          />
        )}
      </div>
    </div>
  );
}
