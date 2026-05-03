import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { DataTable } from "@/components/AdminShell";
import { instructorNav } from "@/lib/instructor-nav";

interface StudentRow {
  id: number;
  full_name: string;
  username: string;
  experiment_condition: string | null;
  submitted_count: number;
  total_words: number | null;
  has_ls: number;
  srl_pre: number | null;
  srl_post: number | null;
}

export default async function StudentsPage() {
  const user = (await getCurrentUser())!;

  const rows = db
    .prepare(
      `SELECT u.id, u.full_name, u.username, u.experiment_condition,
              (SELECT COUNT(*) FROM submissions s
                JOIN assignments a ON a.id = s.assignment_id
                JOIN modules m ON m.id = a.module_id
                JOIN courses c ON c.id = m.course_id
                WHERE c.owner_instructor_id = ? AND s.user_id = u.id) AS submitted_count,
              (SELECT 1 FROM learning_styles WHERE user_id = u.id) AS has_ls,
              (SELECT score_total FROM srl_responses WHERE user_id = u.id AND phase='pre') AS srl_pre,
              (SELECT score_total FROM srl_responses WHERE user_id = u.id AND phase='post') AS srl_post
       FROM users u
       WHERE u.id IN (
         SELECT DISTINCT ce.user_id FROM course_enrollments ce
         JOIN courses c ON c.id = ce.course_id
         WHERE c.owner_instructor_id = ? AND ce.role_in_course = 'student'
       )
       ORDER BY u.full_name`,
    )
    .all(user.id, user.id) as Array<Omit<StudentRow, "total_words"> & { total_words: null }>;

  return (
    <AdminShell
      title="Sinh viên"
      fullName={user.full_name}
      role="instructor"
      nav={instructorNav("students")}
    >
      <p className="text-sm text-slate-500 mb-3">
        Sinh viên đã đăng ký vào các khoá bạn phụ trách.
      </p>
      <DataTable
        rows={rows as StudentRow[]}
        empty="Chưa có sinh viên trong các khoá của bạn."
        columns={[
          {
            key: "name",
            header: "Họ tên",
            render: (r) => (
              <div>
                <p className="font-medium">{r.full_name}</p>
                <p className="text-xs text-slate-400 font-mono">@{r.username}</p>
              </div>
            ),
          },
          {
            key: "cond",
            header: "Nhóm",
            render: (r) =>
              r.experiment_condition === "personalized" ? (
                <span className="badge-green">Cá nhân hoá</span>
              ) : (
                <span className="badge-slate">Đối chứng</span>
              ),
          },
          {
            key: "onboard",
            header: "Onboarding",
            render: (r) => (
              <div className="text-xs">
                {r.has_ls ? "✓ LS" : "—"} · {r.srl_pre !== null ? `SRL pre ${r.srl_pre}` : "— SRL pre"}
                {r.srl_post !== null && ` · SRL post ${r.srl_post}`}
              </div>
            ),
          },
          {
            key: "submitted",
            header: "Đã nộp",
            render: (r) => r.submitted_count,
          },
        ]}
      />
    </AdminShell>
  );
}
