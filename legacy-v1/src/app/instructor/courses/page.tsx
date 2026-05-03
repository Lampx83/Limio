import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { DataTable } from "@/components/AdminShell";
import { instructorNav } from "@/lib/instructor-nav";
import NewCourseForm from "./new-course-form";

interface CourseRow {
  id: number;
  code: string;
  title: string;
  module_count: number;
  student_count: number;
}

export default async function InstructorCoursesPage() {
  const user = (await getCurrentUser())!;

  const rows = db
    .prepare(
      `SELECT c.id, c.code, c.title,
              (SELECT COUNT(*) FROM modules WHERE course_id = c.id) AS module_count,
              (SELECT COUNT(*) FROM course_enrollments WHERE course_id = c.id AND role_in_course = 'student') AS student_count
       FROM courses c WHERE c.owner_instructor_id = ?
       ORDER BY c.created_at DESC`,
    )
    .all(user.id) as CourseRow[];

  return (
    <AdminShell
      title="Khoá học của tôi"
      fullName={user.full_name}
      role="instructor"
      nav={instructorNav("courses")}
    >
      <div className="mb-5">
        <NewCourseForm />
      </div>

      <h2 className="text-lg font-semibold mb-3">Danh sách khoá học</h2>
      <DataTable
        rows={rows}
        empty="Bạn chưa khởi tạo khoá học nào."
        columns={[
          {
            key: "code",
            header: "Mã",
            render: (r) => <span className="font-mono text-xs">{r.code}</span>,
          },
          {
            key: "title",
            header: "Tên",
            render: (r) => (
              <Link
                href={`/instructor/courses/${r.id}`}
                className="font-medium text-brand-600 hover:underline"
              >
                {r.title}
              </Link>
            ),
          },
          {
            key: "modules",
            header: "Module",
            render: (r) => r.module_count,
          },
          {
            key: "students",
            header: "Sinh viên",
            render: (r) => r.student_count,
          },
        ]}
      />
    </AdminShell>
  );
}
