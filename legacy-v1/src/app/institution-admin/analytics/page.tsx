import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { StatCard } from "@/components/AdminShell";
import { institutionAdminNav } from "@/lib/instructor-nav";
import { BarChart, PrePostBar } from "@/components/Charts";

export default async function InstitutionAnalyticsPage() {
  const user = (await getCurrentUser())!;
  const iid = user.institution_id!;

  // Avg SRL by phase × condition
  const srl = db
    .prepare(
      `SELECT u.experiment_condition AS cond, sr.phase AS phase,
              ROUND(AVG(sr.score_total), 2) AS avg_total,
              ROUND(AVG(sr.score_forethought), 2) AS avg_fore,
              ROUND(AVG(sr.score_performance), 2) AS avg_perf,
              ROUND(AVG(sr.score_reflection), 2) AS avg_ref,
              COUNT(*) AS n
       FROM srl_responses sr
       JOIN users u ON u.id = sr.user_id
       WHERE u.institution_id = ? GROUP BY u.experiment_condition, sr.phase`,
    )
    .all(iid) as Array<{
    cond: string | null;
    phase: string;
    avg_total: number;
    avg_fore: number;
    avg_perf: number;
    avg_ref: number;
    n: number;
  }>;

  const fb = db
    .prepare(
      `SELECT f.condition AS cond,
              ROUND(AVG(f.score), 2) AS avg_score,
              COUNT(*) AS n,
              SUM(CASE WHEN f.status = 'approved' THEN 1 ELSE 0 END) AS n_approved
       FROM ai_feedbacks f
       JOIN submissions s ON s.id = f.submission_id
       JOIN assignments a ON a.id = s.assignment_id
       JOIN modules m ON m.id = a.module_id
       JOIN courses c ON c.id = m.course_id
       WHERE c.institution_id = ?
       GROUP BY f.condition`,
    )
    .all(iid) as Array<{ cond: string; avg_score: number; n: number; n_approved: number }>;

  const matFb = db
    .prepare(
      `SELECT mf.condition AS cond, COUNT(*) AS n
       FROM material_feedbacks mf
       JOIN material_interactions mi ON mi.id = mf.interaction_id
       JOIN learning_materials lm ON lm.id = mi.material_id
       JOIN modules m ON m.id = lm.module_id
       JOIN courses c ON c.id = m.course_id
       WHERE c.institution_id = ?
       GROUP BY mf.condition`,
    )
    .all(iid) as Array<{ cond: string; n: number }>;

  return (
    <AdminShell
      title="Phân tích thực nghiệm"
      fullName={user.full_name}
      role="institution_admin"
      nav={institutionAdminNav("analytics")}
    >
      <p className="text-sm text-slate-500 mb-4">
        So sánh nhanh nhóm Đối chứng (control) vs Cá nhân hoá (personalized) tại cơ sở.
      </p>

      {/* Pre/Post chart by condition */}
      {(() => {
        const ctrlPre = srl.find((s) => s.cond === "control" && s.phase === "pre");
        const ctrlPost = srl.find((s) => s.cond === "control" && s.phase === "post");
        const persPre = srl.find((s) => s.cond === "personalized" && s.phase === "pre");
        const persPost = srl.find((s) => s.cond === "personalized" && s.phase === "post");
        return (
          <div className="card p-4 sm:p-5 mb-5">
            <h3 className="font-semibold mb-3">SRL Pre vs Post (so sánh nhóm)</h3>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <p className="text-sm font-medium mb-2">Đối chứng</p>
                <div className="space-y-2">
                  <PrePostBar label="Forethought" pre={ctrlPre?.avg_fore ?? null} post={ctrlPost?.avg_fore ?? null} />
                  <PrePostBar label="Performance" pre={ctrlPre?.avg_perf ?? null} post={ctrlPost?.avg_perf ?? null} />
                  <PrePostBar label="Reflection" pre={ctrlPre?.avg_ref ?? null} post={ctrlPost?.avg_ref ?? null} />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Cá nhân hoá</p>
                <div className="space-y-2">
                  <PrePostBar label="Forethought" pre={persPre?.avg_fore ?? null} post={persPost?.avg_fore ?? null} />
                  <PrePostBar label="Performance" pre={persPre?.avg_perf ?? null} post={persPost?.avg_perf ?? null} />
                  <PrePostBar label="Reflection" pre={persPre?.avg_ref ?? null} post={persPost?.avg_ref ?? null} />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* AI feedback score distribution */}
      {fb.length > 0 && (
        <div className="card p-4 sm:p-5 mb-5">
          <h3 className="font-semibold mb-3">Điểm AI feedback trung bình theo nhóm</h3>
          <BarChart
            data={fb.map((f) => ({
              label: f.cond === "personalized" ? "Cá nhân hoá" : "Đối chứng",
              value: f.avg_score ?? 0,
            }))}
            height={120}
          />
        </div>
      )}

      <h3 className="font-semibold mb-2">SRL trung bình theo phase × nhóm</h3>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {srl.length === 0 && (
          <p className="text-sm text-slate-500 col-span-2">Chưa có dữ liệu SRL.</p>
        )}
        {srl.map((s, i) => (
          <div key={i} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">
                {s.cond === "personalized" ? "Cá nhân hoá" : "Đối chứng"} · {s.phase === "pre" ? "Pre-test" : "Post-test"}
              </p>
              <span className="text-xs text-slate-400">n={s.n}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              <Stat label="Tổng" value={s.avg_total} />
              <Stat label="F" value={s.avg_fore} />
              <Stat label="P" value={s.avg_perf} />
              <Stat label="R" value={s.avg_ref} />
            </div>
          </div>
        ))}
      </div>

      <h3 className="font-semibold mb-2">AI feedback bài tập</h3>
      <div className="grid sm:grid-cols-2 gap-3 mb-6">
        {fb.length === 0 && (
          <p className="text-sm text-slate-500 col-span-2">Chưa có AI feedback nào.</p>
        )}
        {fb.map((f, i) => (
          <StatCard
            key={i}
            label={f.cond === "personalized" ? "Cá nhân hoá" : "Đối chứng"}
            value={f.avg_score ?? "—"}
            hint={`${f.n} feedback · ${f.n_approved} đã duyệt`}
          />
        ))}
      </div>

      <h3 className="font-semibold mb-2">AI feedback học liệu (số lượt)</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {matFb.length === 0 && (
          <p className="text-sm text-slate-500 col-span-2">Chưa có feedback học liệu nào.</p>
        )}
        {matFb.map((m, i) => (
          <StatCard
            key={i}
            label={m.cond === "personalized" ? "Cá nhân hoá" : "Đối chứng"}
            value={m.n}
          />
        ))}
      </div>
    </AdminShell>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-base font-bold">{value ?? "—"}</p>
    </div>
  );
}
