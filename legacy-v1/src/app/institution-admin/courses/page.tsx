import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { DataTable } from "@/components/AdminShell";
import { institutionAdminNav } from "@/lib/instructor-nav";

interface CourseRow {
  id: number;
  code: string;
  title: string;
  owner_name: string | null;
  module_count: number;
  student_count: number;
  submission_count: number;
}

export default async function InstitutionCoursesPage() {
  const user = (await getCurrentUser())!;
  const rows = db
    .prepare(
      `SELECT c.id, c.code, c.title,
              u.full_name AS owner_name,
              (SELECT COUNT(*) FROM modules WHERE course_id = c.id) AS module_count,
              (SELECT COUNT(*) FROM course_enrollments WHERE course_id = c.id AND role_in_course = 'student') AS student_count,
              (SELECT COUNT(*) FROM submissions s
                JOIN assignments a ON a.id = s.assignment_id
                JOIN modules m ON m.id = a.module_id
                WHERE m.course_id = c.id) AS submission_count
       FROM courses c
       LEFT JOIN users u ON u.id = c.owner_instructor_id
       WHERE c.institution_id = ?
       ORDER BY c.created_at DESC`,
    )
    .all(user.institution_id) as CourseRow[];

  return (
    <AdminShell
      title="Khoá học cơ sở"
      fullName={user.full_name}
      role="institution_admin"
      nav={institutionAdminNav("courses")}
    >
      <DataTable
        rows={rows}
        empty="Cơ sở chưa có khoá học."
        columns={[
          {
            key: "code",
            header: "Mã",
            render: (r) => <span className="font-mono text-xs">{r.code}</span>,
          },
          {
            key: "title",
            header: "Tên",
            render: (r) => <span className="font-medium">{r.title}</span>,
          },
          {
            key: "owner",
            header: "Giảng viên",
            render: (r) => r.owner_name ?? "—",
          },
          {
            key: "stats",
            header: "Thống kê",
            render: (r) => (
              <span className="text-xs text-slate-500">
                {r.module_count} module · {r.student_count} SV · {r.submission_count} bài nộp
              </span>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
