import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Header from "@/components/Header";

interface ModuleRow {
  id: number;
  title: string;
  description: string;
}
interface AssignRow {
  id: number;
  title: string;
  prompt: string;
  min_words: number;
  submission_id: number | null;
  feedback_id: number | null;
}
type MaterialType = "video" | "pdf" | "quiz" | "slides" | "file" | "link" | "poll" | "discussion";
interface MaterialRow {
  id: number;
  type: MaterialType;
  title: string;
  description: string | null;
  duration_min: number | null;
  order_idx: number;
  interaction_id: number | null;
  score: number | null;
  fb_id: number | null;
}

const TYPE_META: Record<MaterialType, { label: string; icon: string; color: string }> = {
  video: { label: "Video", icon: "▶", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200" },
  pdf: { label: "Đọc", icon: "📖", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" },
  quiz: { label: "Quiz", icon: "✓", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200" },
  slides: { label: "Slides", icon: "🖼", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200" },
  file: { label: "Tệp", icon: "📎", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200" },
  link: { label: "Link", icon: "🔗", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200" },
  poll: { label: "Khảo sát", icon: "📊", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200" },
  discussion: { label: "Thảo luận", icon: "💬", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-200" },
};

export default async function ModulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const moduleId = Number(id);
  if (!Number.isFinite(moduleId)) notFound();

  const user = (await getCurrentUser())!;
  const mod = db
    .prepare("SELECT id, title, description FROM modules WHERE id = ?")
    .get(moduleId) as ModuleRow | undefined;
  if (!mod) notFound();

  const materials = db
    .prepare(
      `SELECT lm.id, lm.type, lm.title, lm.description, lm.duration_min, lm.order_idx,
              mi.id AS interaction_id, mi.score,
              mf.id AS fb_id
       FROM learning_materials lm
       LEFT JOIN material_interactions mi ON mi.material_id = lm.id AND mi.user_id = ?
       LEFT JOIN material_feedbacks mf ON mf.interaction_id = mi.id
       WHERE lm.module_id = ?
       ORDER BY lm.order_idx`,
    )
    .all(user.id, moduleId) as MaterialRow[];

  const assignments = db
    .prepare(
      `SELECT a.id, a.title, a.prompt, a.min_words,
              s.id AS submission_id,
              f.id AS feedback_id
       FROM assignments a
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = ?
       LEFT JOIN ai_feedbacks f ON f.submission_id = s.id
       WHERE a.module_id = ?
       ORDER BY a.order_idx`,
    )
    .all(user.id, moduleId) as AssignRow[];

  return (
    <div className="min-h-screen">
      <Header
        title={mod.title}
        fullName={user.full_name}
        role="student"
      />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <Link href="/student" className="text-sm text-brand-600 hover:underline">
          ← Quay lại bảng điều khiển
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold mt-2 mb-1">{mod.title}</h1>
        <p className="text-slate-600 mb-6 text-sm sm:text-base">{mod.description}</p>

        {materials.length > 0 && (
          <section className="mb-8">
            <h2 className="text-base sm:text-lg font-semibold mb-3 flex items-center gap-2">
              <span>Học liệu tự học</span>
              <span className="text-xs text-slate-400 font-normal">
                ({materials.filter((m) => m.interaction_id).length}/{materials.length})
              </span>
            </h2>
            <ul className="space-y-2.5">
              {materials.map((m) => {
                const meta = TYPE_META[m.type];
                const done = !!m.interaction_id;
                return (
                  <li key={m.id}>
                    <Link
                      href={`/student/materials/${m.id}`}
                      className="card p-3 sm:p-4 hover:border-brand-400 hover:shadow transition flex items-start gap-3 group"
                    >
                      <div className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-base ${meta.color}`}>
                        <span>{meta.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`badge ${meta.color}`}>{meta.label}</span>
                          {m.duration_min && (
                            <span className="text-xs text-slate-400">
                              ~{m.duration_min} phút
                            </span>
                          )}
                          {done && (
                            <span className="badge-green">
                              ✓ Đã hoàn thành{m.score !== null ? ` (${m.score}/100)` : ""}
                            </span>
                          )}
                          {m.fb_id && <span className="badge-blue">Có AI feedback</span>}
                        </div>
                        <h3 className="font-medium mt-1 text-sm sm:text-base group-hover:text-brand-700">
                          {m.title}
                        </h3>
                        {m.description && (
                          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 line-clamp-2">
                            {m.description}
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {assignments.length > 0 && (
          <section>
            <h2 className="text-base sm:text-lg font-semibold mb-3">Bài tập</h2>
            <ul className="space-y-2.5">
              {assignments.map((a) => (
                <li key={a.id} className="card p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base mb-1">
                        {a.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 line-clamp-2">
                        {a.prompt}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Tối thiểu {a.min_words} từ
                      </p>
                    </div>
                    <div className="shrink-0 w-full sm:w-auto">
                      {a.feedback_id ? (
                        <Link
                          href={`/student/feedback/${a.submission_id}`}
                          className="btn-secondary w-full sm:w-auto"
                        >
                          Xem phản hồi
                        </Link>
                      ) : a.submission_id ? (
                        <span className="badge-amber">Đang chờ phản hồi</span>
                      ) : (
                        <Link
                          href={`/student/assignments/${a.id}`}
                          className="btn-primary w-full sm:w-auto"
                        >
                          Làm bài
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
