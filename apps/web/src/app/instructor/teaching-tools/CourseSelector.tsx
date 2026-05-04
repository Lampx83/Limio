"use client";

interface Course {
  id: string;
  title: string;
  _count: {
    enrollments: number;
  };
}

interface CourseSelectorProps {
  courses: Course[];
  selectedCourseId: string | null;
  onSelectCourse: (courseId: string | null) => void;
  enrollmentCount: number;
  isLoading: boolean;
}

export default function CourseSelector({
  courses,
  selectedCourseId,
  onSelectCourse,
  enrollmentCount,
  isLoading,
}: CourseSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label mb-2 block font-medium">Chọn khóa học</label>
        <select
          value={selectedCourseId || ""}
          onChange={(e) => onSelectCourse(e.target.value || null)}
          disabled={isLoading}
          className="input w-full"
        >
          <option value="">Không chọn (nhập danh sách thủ công)</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title} ({course._count.enrollments} học viên)
            </option>
          ))}
        </select>
      </div>

      {selectedCourseId && (
        <div className="rounded border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            {isLoading ? "Đang tải..." : `✓ Đã chọn ${enrollmentCount} sinh viên từ khóa học`}
          </p>
        </div>
      )}
    </div>
  );
}
