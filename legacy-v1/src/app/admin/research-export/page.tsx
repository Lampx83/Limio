import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell from "@/components/AdminShell";
import { systemAdminNav } from "@/lib/instructor-nav";

interface Counts {
  submissions: number;
  feedbacks: number;
  logs: number;
  srl: number;
}

export default async function ResearchExportPage() {
  const user = (await getCurrentUser())!;
  const counts: Counts = {
    submissions: (db.prepare("SELECT COUNT(*) AS n FROM submissions").get() as { n: number }).n,
    feedbacks: (db.prepare("SELECT COUNT(*) AS n FROM ai_feedbacks").get() as { n: number }).n,
    logs: (db.prepare("SELECT COUNT(*) AS n FROM behavioral_logs").get() as { n: number }).n,
    srl: (db.prepare("SELECT COUNT(*) AS n FROM srl_responses").get() as { n: number }).n,
  };

  const exports = [
    { kind: "users", label: "Người dùng (ẩn danh hoá)", n: null, desc: "id, role, condition, institution_id, ngày tạo (KHÔNG có username/họ tên)" },
    { kind: "submissions", label: "Bài nộp", n: counts.submissions, desc: "id, user_id, assignment_id, time_spent, edit_count, paste_count, word_count" },
    { kind: "ai_feedbacks", label: "AI Feedback bài tập", n: counts.feedbacks, desc: "Toàn bộ trường feed_up/back/forward, score, condition, status" },
    { kind: "material_interactions", label: "Tương tác học liệu", n: null, desc: "id, user_id, material_id, type, score, completed_at" },
    { kind: "material_feedbacks", label: "AI Feedback học liệu", n: null, desc: "summary/strengths/gaps/next_steps/metacog_prompt theo condition" },
    { kind: "behavioral_logs", label: "Behavioral logs", n: counts.logs, desc: "Tất cả sự kiện open/focus/blur/paste/submit/view" },
    { kind: "srl", label: "SRL pre/post", n: counts.srl, desc: "score_total, _forethought, _performance, _reflection theo phase" },
    { kind: "learning_styles", label: "Phong cách học", n: null, desc: "Felder-Silverman 4 chiều" },
  ];

  return (
    <AdminShell
      title="Xuất dữ liệu nghiên cứu"
      fullName={user.full_name}
      role="system_admin"
      nav={systemAdminNav("export")}
    >
      <p className="text-sm text-slate-500 mb-4">
        Xuất CSV cho phân tích thống kê. Dữ liệu được ẩn danh hoá theo
        nguyên tắc IRB (không có username/email/họ tên).
      </p>

      <ul className="space-y-2">
        {exports.map((e) => (
          <li key={e.kind} className="card p-3 sm:p-4 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="font-medium">
                {e.label}
                {e.n !== null && (
                  <span className="text-xs text-slate-500 ml-2">({e.n} dòng)</span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{e.desc}</p>
            </div>
            <a
              href={`/api/admin/export?kind=${e.kind}`}
              className="btn-primary text-sm"
              download
            >
              Tải CSV
            </a>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
