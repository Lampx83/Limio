import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import { StatCard } from "@/components/AdminShell";
import { describeStyle } from "@/lib/learning-style";
import { srlLevel } from "@/lib/srl-questions";
import { recommendNext } from "@/lib/recommendation";
import GoalsWidget, { type GoalRow } from "./goals-widget";
import ReflectionWidget, { type ReflectionRow } from "./reflection-widget";
import { DonutChart, PrePostBar } from "@/components/Charts";

interface ModuleRow {
  id: number;
  title: string;
  description: string;
  order_idx: number;
  assignment_count: number;
  submitted_count: number;
  material_count: number;
  material_done: number;
}
interface SRLRow {
  total: number | null;
  forethought: number | null;
  performance: number | null;
  reflection: number | null;
}
interface LSRow {
  active_reflective: number;
  sensing_intuitive: number;
  visual_verbal: number;
  sequential_global: number;
}
interface RecentFb {
  submission_id: number;
  assignment_title: string;
  score: number | null;
  status: string | null;
  created_at: string;
}

export default async function StudentDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ls = db
    .prepare(
      "SELECT active_reflective, sensing_intuitive, visual_verbal, sequential_global FROM learning_styles WHERE user_id = ?",
    )
    .get(user.id) as LSRow | undefined;
  const srlPre = db
    .prepare(
      "SELECT score_total AS total, score_forethought AS forethought, score_performance AS performance, score_reflection AS reflection FROM srl_responses WHERE user_id = ? AND phase='pre'",
    )
    .get(user.id) as SRLRow | undefined;
  if (!ls || !srlPre) redirect("/student/onboarding");

  const srlPost = db
    .prepare(
      "SELECT score_total AS total, score_forethought AS forethought, score_performance AS performance, score_reflection AS reflection FROM srl_responses WHERE user_id = ? AND phase='post'",
    )
    .get(user.id) as SRLRow | undefined;

  const modules = db
    .prepare(
      `SELECT m.id, m.title, m.description, m.order_idx,
              (SELECT COUNT(*) FROM assignments WHERE module_id = m.id) AS assignment_count,
              (SELECT COUNT(*) FROM submissions s
                JOIN assignments a ON a.id = s.assignment_id
                WHERE a.module_id = m.id AND s.user_id = ?) AS submitted_count,
              (SELECT COUNT(*) FROM learning_materials WHERE module_id = m.id) AS material_count,
              (SELECT COUNT(*) FROM material_interactions mi
                JOIN learning_materials lm ON lm.id = mi.material_id
                WHERE lm.module_id = m.id AND mi.user_id = ?) AS material_done
       FROM modules m ORDER BY m.order_idx`,
    )
    .all(user.id, user.id) as ModuleRow[];

  const totalAssignments = modules.reduce((s, m) => s + m.assignment_count, 0);
  const totalDone = modules.reduce((s, m) => s + m.submitted_count, 0);
  const totalMaterials = modules.reduce((s, m) => s + m.material_count, 0);
  const matDone = modules.reduce((s, m) => s + m.material_done, 0);
  const overallProgress =
    totalAssignments + totalMaterials > 0
      ? Math.round(
          ((totalDone + matDone) / (totalAssignments + totalMaterials)) * 100,
        )
      : 0;

  const recent = db
    .prepare(
      `SELECT s.id AS submission_id, a.title AS assignment_title,
              f.score, f.status, f.created_at
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       LEFT JOIN ai_feedbacks f ON f.submission_id = s.id
       WHERE s.user_id = ?
       ORDER BY s.submitted_at DESC LIMIT 3`,
    )
    .all(user.id) as RecentFb[];

  const goals = db
    .prepare(
      "SELECT id, title, target_date, strategy, status, created_at, completed_at FROM learning_goals WHERE user_id = ? ORDER BY status='active' DESC, created_at DESC",
    )
    .all(user.id) as GoalRow[];

  const reflections = db
    .prepare(
      "SELECT id, prompt, content, created_at FROM reflections WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
    )
    .all(user.id) as ReflectionRow[];

  const announcements = db
    .prepare(
      `SELECT a.id, a.title, a.body, a.created_at, u.full_name AS author
       FROM announcements a
       JOIN courses c ON c.id = a.course_id
       JOIN course_enrollments ce ON ce.course_id = c.id AND ce.user_id = ?
       JOIN users u ON u.id = a.author_id
       ORDER BY a.pinned DESC, a.created_at DESC LIMIT 3`,
    )
    .all(user.id) as Array<{ id: number; title: string; body: string; created_at: string; author: string }>;

  const peerPending = (db
    .prepare(
      "SELECT COUNT(*) AS n FROM peer_reviews WHERE reviewer_id = ? AND status = 'pending'",
    )
    .get(user.id) as { n: number }).n;

  // Tìm module/material kế tiếp để gợi ý "Tiếp tục"
  const nextMaterial = db
    .prepare(
      `SELECT lm.id, lm.title, lm.type, lm.module_id, m.title AS module_title
       FROM learning_materials lm
       JOIN modules m ON m.id = lm.module_id
       LEFT JOIN material_interactions mi ON mi.material_id = lm.id AND mi.user_id = ?
       WHERE mi.id IS NULL
       ORDER BY lm.module_id, lm.order_idx LIMIT 1`,
    )
    .get(user.id) as
    | { id: number; title: string; type: string; module_id: number; module_title: string }
    | undefined;

  const srlPostDone = !!srlPost;

  return (
    <div className="min-h-screen">
      <Header
        title="Bảng điều khiển"
        fullName={user.full_name}
        role="student"
      />
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Lời chào + tiến độ tổng */}
        <div className="card p-5 sm:p-6 mb-5 bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/20 dark:to-slate-900">
          <h1 className="text-xl sm:text-2xl font-bold mb-1">
            Xin chào, {user.full_name.split(" ").slice(-1)[0]} 👋
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
            Khoá: <em>Nhập môn Công nghệ Giáo dục</em>
          </p>
          <ProgressBar value={overallProgress} />
          <p className="text-xs text-slate-500 mt-2">
            Tiến độ tổng: <strong>{overallProgress}%</strong> · Học liệu {matDone}/{totalMaterials} · Bài tập {totalDone}/{totalAssignments}
          </p>
        </div>

        {peerPending > 0 && (
          <Link
            href="/student/peer-reviews"
            className="card p-3 sm:p-4 mb-5 flex items-center justify-between gap-3 border-pink-300 bg-pink-50 dark:bg-pink-900/20 hover:border-pink-400"
          >
            <div>
              <p className="font-medium">💬 Bạn có {peerPending} peer review chờ làm</p>
              <p className="text-xs text-slate-500">
                Đọc bài và nhận xét cho bạn cùng lớp
              </p>
            </div>
            <span className="btn-primary shrink-0 text-sm">Xem →</span>
          </Link>
        )}

        {/* Announcements */}
        {announcements.length > 0 && (
          <section className="mb-5">
            <h2 className="text-base sm:text-lg font-semibold mb-2 flex items-center gap-2">
              <span>📢 Thông báo từ giảng viên</span>
            </h2>
            <ul className="space-y-2">
              {announcements.map((a) => (
                <li
                  key={a.id}
                  className="card p-3 sm:p-4 border-amber-300 bg-amber-50 dark:bg-amber-900/20"
                >
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-wrap">
                    {a.body}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    — {a.author} · {a.created_at}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Smart recommendations */}
        {(() => {
          const recs = recommendNext(user.id);
          return recs.length > 0 ? (
            <section className="mb-5">
              <h2 className="text-base sm:text-lg font-semibold mb-2 flex items-center gap-2">
                <span>💡 Gợi ý dành cho bạn</span>
              </h2>
              <ul className="space-y-2">
                {recs.map((r, idx) => (
                  <RecCard key={idx} rec={r} />
                ))}
              </ul>
            </section>
          ) : null;
        })()}

        {/* Tiếp tục */}
        {nextMaterial && (
          <Link
            href={`/student/materials/${nextMaterial.id}`}
            className="card p-4 sm:p-5 mb-5 flex items-center justify-between gap-3 hover:border-brand-400 transition"
          >
            <div className="min-w-0">
              <p className="text-xs text-slate-500">Tiếp tục từ điểm dừng</p>
              <p className="font-medium truncate">{nextMaterial.title}</p>
              <p className="text-xs text-slate-400">{nextMaterial.module_title}</p>
            </div>
            <span className="btn-primary shrink-0 text-sm">Tiếp tục →</span>
          </Link>
        )}

        {/* SRL pre/post chart */}
        <div className="card p-4 sm:p-5 mb-5">
          <h2 className="font-semibold text-base mb-3 flex items-center justify-between gap-2 flex-wrap">
            <span>📈 Tự điều chỉnh học tập (SRL)</span>
            <span className="text-xs text-slate-500 font-normal">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1" /> Pre
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-2 mr-1" /> Post
            </span>
          </h2>
          <div className="grid sm:grid-cols-3 gap-3 sm:gap-5 items-center">
            <DonutChart
              value={overallProgress}
              label="Tiến độ khoá"
              color="#3b82f6"
            />
            <div className="sm:col-span-2 space-y-2">
              <PrePostBar
                label="Forethought (lập kế hoạch)"
                pre={srlPre.forethought}
                post={srlPost?.forethought ?? null}
              />
              <PrePostBar
                label="Performance (giám sát)"
                pre={srlPre.performance}
                post={srlPost?.performance ?? null}
              />
              <PrePostBar
                label="Reflection (suy ngẫm)"
                pre={srlPre.reflection}
                post={srlPost?.reflection ?? null}
              />
            </div>
          </div>
          {!srlPost && (
            <p className="text-xs text-slate-500 mt-3 italic">
              SRL post sẽ hiển thị sau khi bạn hoàn tất khoá học và làm bảng hỏi
              hậu thực nghiệm.
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard
            label="Học liệu"
            value={`${matDone}/${totalMaterials}`}
            hint="Video / PDF / Quiz"
          />
          <StatCard
            label="Bài tập"
            value={`${totalDone}/${totalAssignments}`}
          />
          <StatCard
            label="SRL hiện tại"
            value={srlPre.total ?? "—"}
            hint={`Mức ${srlLevel(srlPre.total ?? 0)}`}
          />
          <StatCard
            label="Phong cách học"
            value={
              <span className="text-xs sm:text-sm">
                {ls
                  ? describeStyle(ls).split(" · ").slice(0, 2).join(" · ")
                  : "—"}
              </span>
            }
          />
        </div>

        {/* SRL: Goals + Reflections */}
        <div className="grid lg:grid-cols-2 gap-3 mb-5">
          <GoalsWidget goals={goals} />
          <ReflectionWidget reflections={reflections} />
        </div>

        {/* Phản hồi gần đây */}
        {recent.length > 0 && (
          <section className="mb-5">
            <h2 className="text-base sm:text-lg font-semibold mb-3">
              Phản hồi gần đây
            </h2>
            <ul className="space-y-2">
              {recent.map((r) => (
                <li key={r.submission_id}>
                  <Link
                    href={`/student/feedback/${r.submission_id}`}
                    className="card p-3 flex items-center justify-between gap-2 hover:border-brand-400"
                  >
                    <p className="font-medium text-sm truncate">{r.assignment_title}</p>
                    <div className="shrink-0 flex items-center gap-2">
                      {r.score !== null && (
                        <span className="badge-blue text-xs">{r.score}</span>
                      )}
                      {r.status === "approved" && (
                        <span className="badge-green text-xs">Đã duyệt</span>
                      )}
                      {r.status === "pending_review" && (
                        <span className="badge-amber text-xs">Chờ duyệt</span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Module list */}
        <h2 className="text-base sm:text-lg font-semibold mb-3">Lộ trình học</h2>
        <div className="grid gap-3">
          {modules.map((m) => {
            const matPct = m.material_count
              ? Math.round((m.material_done / m.material_count) * 100)
              : 0;
            const asgPct = m.assignment_count
              ? Math.round((m.submitted_count / m.assignment_count) * 100)
              : 0;
            return (
              <Link
                key={m.id}
                href={`/student/modules/${m.id}`}
                className="card p-4 sm:p-5 hover:border-brand-400 hover:shadow transition"
              >
                <div className="flex items-start justify-between mb-2 gap-2">
                  <h3 className="font-semibold text-sm sm:text-base">
                    {m.title}
                  </h3>
                  {m.material_done === m.material_count &&
                    m.submitted_count === m.assignment_count && (
                      <span className="badge-green text-xs shrink-0">✓ Xong</span>
                    )}
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mb-3 line-clamp-2">
                  {m.description}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <MiniProgress
                    label={`Học liệu (${m.material_done}/${m.material_count})`}
                    pct={matPct}
                  />
                  <MiniProgress
                    label={`Bài tập (${m.submitted_count}/${m.assignment_count})`}
                    pct={asgPct}
                  />
                </div>
              </Link>
            );
          })}
        </div>

        {totalDone === totalAssignments && totalAssignments > 0 && !srlPostDone && (
          <div className="card p-5 mt-6 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20">
            <h3 className="font-semibold mb-1">
              Đã hoàn thành tất cả bài tập!
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-200 mb-3">
              Vui lòng làm bảng hỏi sau thực nghiệm để hoàn tất tham gia nghiên cứu.
            </p>
            <Link href="/student/srl-post" className="btn-primary">
              Làm bảng hỏi SRL hậu thực nghiệm
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}

function RecCard({ rec }: { rec: ReturnType<typeof recommendNext>[0] }) {
  const meta: Record<
    string,
    { color: string; label: string; icon: string }
  > = {
    review: {
      color: "border-amber-300 bg-amber-50 dark:bg-amber-900/20",
      label: "Ôn lại",
      icon: "↺",
    },
    next: {
      color: "border-brand-300 bg-brand-50 dark:bg-brand-900/20",
      label: "Tiếp theo",
      icon: "→",
    },
    challenge: {
      color: "border-violet-300 bg-violet-50 dark:bg-violet-900/20",
      label: "Thử thách",
      icon: "★",
    },
    srl_alert: {
      color: "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20",
      label: "Mẹo học",
      icon: "🌱",
    },
  };
  const m = meta[rec.type];
  const inner = (
    <div className={`card border ${m.color} p-3 sm:p-4`}>
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">{m.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase font-semibold text-slate-600 dark:text-slate-300">
            {m.label}
          </p>
          {rec.material_title && (
            <p className="font-medium mt-0.5">{rec.material_title}</p>
          )}
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
            {rec.reason}
          </p>
        </div>
      </div>
    </div>
  );
  if (rec.material_id) {
    return (
      <li>
        <Link href={`/student/materials/${rec.material_id}`}>{inner}</Link>
      </li>
    );
  }
  return <li>{inner}</li>;
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-brand-500 to-brand-700 rounded-full transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function MiniProgress({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
