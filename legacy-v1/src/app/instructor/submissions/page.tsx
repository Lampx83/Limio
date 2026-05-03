import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { DataTable } from "@/components/AdminShell";
import { instructorNav } from "@/lib/instructor-nav";

interface SubRow {
  id: number;
  student_name: string;
  assignment_title: string;
  course_title: string;
  submitted_at: string;
  status: string | null;
  score: number | null;
  condition: string | null;
}

export default async function SubmissionsPage() {
  const user = (await getCurrentUser())!;

  const rows = db
    .prepare(
      `SELECT s.id, u.full_name AS student_name, a.title AS assignment_title,
              c.title AS course_title, s.submitted_at,
              f.status, f.score, f.condition
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN modules m ON m.id = a.module_id
       JOIN courses c ON c.id = m.course_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN ai_feedbacks f ON f.submission_id = s.id
       WHERE c.owner_instructor_id = ?
       ORDER BY s.submitted_at DESC`,
    )
    .all(user.id) as SubRow[];

  return (
    <AdminShell
      title="Bài nộp & AI Feedback"
      fullName={user.full_name}
      role="instructor"
      nav={instructorNav("submissions")}
    >
      <p className="text-sm text-slate-500 mb-3">
        Duyệt feedback AI (human-in-the-loop) - đảm bảo chất lượng sư phạm trước
        khi sinh viên đọc.
      </p>
      <DataTable
        rows={rows}
        empty="Chưa có bài nộp nào trong các khoá bạn phụ trách."
        columns={[
          {
            key: "student",
            header: "Sinh viên",
            render: (r) => <span className="font-medium">{r.student_name}</span>,
          },
          {
            key: "assignment",
            header: "Bài tập",
            render: (r) => (
              <Link
                href={`/instructor/submissions/${r.id}`}
                className="text-brand-600 hover:underline"
              >
                {r.assignment_title}
              </Link>
            ),
          },
          {
            key: "course",
            header: "Khoá",
            render: (r) => <span className="text-xs text-slate-500">{r.course_title}</span>,
          },
          {
            key: "submitted",
            header: "Nộp lúc",
            render: (r) => (
              <span className="text-xs text-slate-500">{r.submitted_at}</span>
            ),
          },
          {
            key: "score",
            header: "Điểm",
            render: (r) =>
              r.score !== null ? <span className="badge-blue">{r.score}/100</span> : "—",
          },
          {
            key: "condition",
            header: "Nhóm",
            render: (r) =>
              r.condition === "personalized" ? (
                <span className="badge-green text-xs">CN hoá</span>
              ) : r.condition === "control" ? (
                <span className="badge-slate text-xs">Đối chứng</span>
              ) : (
                "—"
              ),
          },
          {
            key: "status",
            header: "Trạng thái",
            render: (r) =>
              r.status === "approved" ? (
                <span className="badge-green">Đã duyệt</span>
              ) : r.status === "revised" ? (
                <span className="badge-amber">Đã sửa</span>
              ) : r.status === "pending_review" ? (
                <span className="badge-amber">Chờ duyệt</span>
              ) : (
                <span className="badge-slate">Chưa có FB</span>
              ),
          },
        ]}
      />
    </AdminShell>
  );
}
