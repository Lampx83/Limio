import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { StatCard } from "@/components/AdminShell";
import { instructorNav } from "@/lib/instructor-nav";

interface Counts {
  courses: number;
  students: number;
  submissions_pending: number;
  submissions_total: number;
  feedback_total: number;
  feedback_approved: number;
}

export default async function InstructorOverview() {
  const user = (await getCurrentUser())!;

  const courses = db
    .prepare(
      "SELECT COUNT(*) AS n FROM courses WHERE owner_instructor_id = ?",
    )
    .get(user.id) as { n: number };

  const students = db
    .prepare(
      `SELECT COUNT(DISTINCT ce.user_id) AS n
       FROM course_enrollments ce
       JOIN courses c ON c.id = ce.course_id
       WHERE c.owner_instructor_id = ? AND ce.role_in_course = 'student'`,
    )
    .get(user.id) as { n: number };

  const submissionsTotal = db
    .prepare(
      `SELECT COUNT(*) AS n FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN modules m ON m.id = a.module_id
       JOIN courses c ON c.id = m.course_id
       WHERE c.owner_instructor_id = ?`,
    )
    .get(user.id) as { n: number };

  const feedbackTotal = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ai_feedbacks f
       JOIN submissions s ON s.id = f.submission_id
       JOIN assignments a ON a.id = s.assignment_id
       JOIN modules mo ON mo.id = a.module_id
       JOIN courses c ON c.id = mo.course_id
       WHERE c.owner_instructor_id = ?`,
    )
    .get(user.id) as { n: number };

  const feedbackPending = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ai_feedbacks f
       JOIN submissions s ON s.id = f.submission_id
       JOIN assignments a ON a.id = s.assignment_id
       JOIN modules mo ON mo.id = a.module_id
       JOIN courses c ON c.id = mo.course_id
       WHERE c.owner_instructor_id = ? AND f.status = 'pending_review'`,
    )
    .get(user.id) as { n: number };

  const feedbackApproved = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ai_feedbacks f
       JOIN submissions s ON s.id = f.submission_id
       JOIN assignments a ON a.id = s.assignment_id
       JOIN modules mo ON mo.id = a.module_id
       JOIN courses c ON c.id = mo.course_id
       WHERE c.owner_instructor_id = ? AND f.status IN ('approved','revised')`,
    )
    .get(user.id) as { n: number };

  const counts: Counts = {
    courses: courses.n,
    students: students.n,
    submissions_total: submissionsTotal.n,
    submissions_pending: feedbackPending.n,
    feedback_total: feedbackTotal.n,
    feedback_approved: feedbackApproved.n,
  };

  // Recent submissions to review (HITL)
  const recent = db
    .prepare(
      `SELECT s.id AS submission_id, s.submitted_at, u.full_name AS student_name,
              a.title AS assignment_title, f.status, f.score
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN modules mo ON mo.id = a.module_id
       JOIN courses c ON c.id = mo.course_id
       JOIN users u ON u.id = s.user_id
       LEFT JOIN ai_feedbacks f ON f.submission_id = s.id
       WHERE c.owner_instructor_id = ?
       ORDER BY s.submitted_at DESC LIMIT 8`,
    )
    .all(user.id) as Array<{
    submission_id: number;
    submitted_at: string;
    student_name: string;
    assignment_title: string;
    status: string | null;
    score: number | null;
  }>;

  return (
    <AdminShell
      title="Tổng quan giảng viên"
      fullName={user.full_name}
      role="instructor"
      nav={instructorNav("overview")}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatCard label="Khoá phụ trách" value={counts.courses} />
        <StatCard label="Sinh viên" value={counts.students} />
        <StatCard label="Bài nộp" value={counts.submissions_total} />
        <StatCard
          label="Feedback chờ duyệt"
          value={counts.submissions_pending}
          hint="Cần xem xét (HITL)"
        />
        <StatCard
          label="Feedback đã duyệt"
          value={counts.feedback_approved}
        />
        <StatCard
          label="Tổng AI feedback"
          value={counts.feedback_total}
        />
      </div>

      <h2 className="text-lg font-semibold mb-3">Bài nộp gần đây</h2>
      <div className="space-y-2">
        {recent.length === 0 && (
          <div className="card p-6 text-center text-slate-500">
            Chưa có bài nộp nào.
          </div>
        )}
        {recent.map((r) => (
          <Link
            key={r.submission_id}
            href={`/instructor/submissions/${r.submission_id}`}
            className="card p-3 sm:p-4 flex items-center justify-between gap-3 hover:border-brand-400"
          >
            <div className="min-w-0">
              <p className="font-medium truncate">{r.assignment_title}</p>
              <p className="text-xs text-slate-500">
                {r.student_name} · {r.submitted_at}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {r.score !== null && <span className="badge-blue">{r.score}/100</span>}
              {r.status === "approved" && <span className="badge-green">Đã duyệt</span>}
              {r.status === "pending_review" && (
                <span className="badge-amber">Chờ duyệt</span>
              )}
              {r.status === "revised" && (
                <span className="badge-amber">Đã sửa</span>
              )}
              {r.status === null && (
                <span className="badge-slate">Chưa có FB</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
