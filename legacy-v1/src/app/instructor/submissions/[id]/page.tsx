import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell from "@/components/AdminShell";
import { instructorNav } from "@/lib/instructor-nav";
import ReviewForm from "./review-form";
import { evaluateIntegrity } from "@/lib/integrity";
import PeerAssign from "./peer-assign";

interface DetailRow {
  submission_id: number;
  user_id: number;
  full_name: string;
  username: string;
  content: string;
  time_spent_sec: number;
  edit_count: number;
  paste_count: number;
  submitted_at: string;
  assignment_title: string;
  assignment_prompt: string;
  rubric: string;
  course_owner: number;
  feedback_id: number | null;
  feed_up: string | null;
  feed_back_task: string | null;
  feed_back_process: string | null;
  feed_back_self_reg: string | null;
  feed_forward: string | null;
  metacog_prompt: string | null;
  score: number | null;
  status: string | null;
  condition: string | null;
  instructor_notes: string | null;
}

export default async function SubmissionReview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sid = Number(id);
  if (!Number.isFinite(sid)) notFound();

  const user = (await getCurrentUser())!;

  const row = db
    .prepare(
      `SELECT s.id AS submission_id, s.user_id, u.full_name, u.username,
              s.content, s.time_spent_sec, s.edit_count, s.paste_count, s.submitted_at,
              a.title AS assignment_title, a.prompt AS assignment_prompt, a.rubric,
              c.owner_instructor_id AS course_owner,
              f.id AS feedback_id, f.feed_up, f.feed_back_task, f.feed_back_process,
              f.feed_back_self_reg, f.feed_forward, f.metacog_prompt, f.score, f.status,
              f.condition, f.instructor_notes
       FROM submissions s
       JOIN users u ON u.id = s.user_id
       JOIN assignments a ON a.id = s.assignment_id
       JOIN modules m ON m.id = a.module_id
       JOIN courses c ON c.id = m.course_id
       LEFT JOIN ai_feedbacks f ON f.submission_id = s.id
       WHERE s.id = ?`,
    )
    .get(sid) as DetailRow | undefined;
  if (!row) notFound();
  if (row.course_owner !== user.id) notFound();

  // Lấy danh sách SV cùng khoá (trừ tác giả) làm reviewer candidates
  const candidates = db
    .prepare(
      `SELECT u.id, u.full_name, u.username
       FROM course_enrollments ce
       JOIN users u ON u.id = ce.user_id
       JOIN assignments a ON a.id = (SELECT assignment_id FROM submissions WHERE id = ?)
       JOIN modules m ON m.id = a.module_id
       WHERE ce.course_id = m.course_id AND ce.role_in_course = 'student' AND ce.user_id != ?
       ORDER BY u.full_name`,
    )
    .all(sid, row.user_id) as Array<{ id: number; full_name: string; username: string }>;

  // Peer review đã assign
  const existingPeer = db
    .prepare(
      `SELECT pr.id, pr.status, u.full_name, u.username
       FROM peer_reviews pr JOIN users u ON u.id = pr.reviewer_id
       WHERE pr.submission_id = ?`,
    )
    .all(sid) as Array<{ id: number; status: string; full_name: string; username: string }>;

  const wordCount = row.content.trim().split(/\s+/).filter(Boolean).length;
  const integrity = evaluateIntegrity({
    word_count: wordCount,
    time_spent_sec: row.time_spent_sec,
    paste_count: row.paste_count,
    edit_count: row.edit_count,
  });

  return (
    <AdminShell
      title={`Bài nộp: ${row.full_name}`}
      fullName={user.full_name}
      role="instructor"
      nav={instructorNav("submissions")}
    >
      <Link
        href="/instructor/submissions"
        className="text-sm text-brand-600 hover:underline"
      >
        ← Danh sách bài nộp
      </Link>

      <PeerAssign
        submissionId={sid}
        candidates={candidates}
        existing={existingPeer}
      />

      <div className="grid lg:grid-cols-2 gap-4 mt-3">
        {/* Bài làm sinh viên */}
        <div className="card p-4 sm:p-5">
          <p className="text-xs text-slate-500 mb-1">Sinh viên</p>
          <h2 className="text-lg font-semibold">{row.full_name} <span className="text-xs font-normal text-slate-400">@{row.username}</span></h2>
          <p className="text-xs text-slate-500 mt-1">
            Bài: {row.assignment_title}
          </p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-500">
            <span>{wordCount} từ</span>
            <span>·</span>
            <span>{Math.round(row.time_spent_sec / 60)} phút làm</span>
            <span>·</span>
            <span>{row.edit_count} lần sửa</span>
            <span>·</span>
            <span>{row.paste_count} lần paste</span>
            {row.condition && (
              <>
                <span>·</span>
                <span className={row.condition === "personalized" ? "badge-green" : "badge-slate"}>
                  {row.condition === "personalized" ? "Cá nhân hoá" : "Đối chứng"}
                </span>
              </>
            )}
          </div>
          {integrity.level !== "low" && (
            <div
              className={`mt-3 p-3 rounded border text-sm ${
                integrity.level === "high"
                  ? "border-rose-300 bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-100"
                  : "border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100"
              }`}
            >
              <p className="font-semibold mb-1">
                ⚠ Cảnh báo liêm chính (heuristic, độ tin{" "}
                {integrity.ai_likelihood_score}/100)
              </p>
              <ul className="text-xs space-y-0.5 list-disc pl-5">
                {integrity.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <p className="text-xs mt-2 italic opacity-80">
                Đây chỉ là gợi ý dựa trên dấu vết hành vi - cần xem xét cùng nội dung bài.
              </p>
            </div>
          )}
          <details className="mt-3" open>
            <summary className="cursor-pointer text-sm font-medium">
              Bài làm
            </summary>
            <div className="mt-2 p-3 rounded bg-slate-50 dark:bg-slate-800/50 whitespace-pre-wrap text-sm font-mono">
              {row.content}
            </div>
          </details>
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium">
              Đề bài & Rubric
            </summary>
            <p className="text-xs text-slate-600 whitespace-pre-wrap mt-2">
              <strong>Đề:</strong> {row.assignment_prompt}
            </p>
            <p className="text-xs text-slate-600 whitespace-pre-wrap mt-2">
              <strong>Rubric:</strong> {row.rubric}
            </p>
          </details>
        </div>

        {/* AI Feedback + duyệt */}
        <div className="card p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-lg font-semibold">AI Feedback</h2>
            {row.score !== null && (
              <span className="badge-blue text-base">{row.score}/100</span>
            )}
          </div>
          {!row.feedback_id ? (
            <p className="text-sm text-slate-500">Chưa có AI feedback.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <Block label="Feed Up" text={row.feed_up} color="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-100" />
              <Block label="Feed Back - Task" text={row.feed_back_task} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100" />
              <Block label="Feed Back - Process" text={row.feed_back_process} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100" />
              <Block label="Feed Back - Self-reg" text={row.feed_back_self_reg} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100" />
              <Block label="Feed Forward" text={row.feed_forward} color="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-100" />
              <Block label="Câu hỏi siêu nhận thức" text={row.metacog_prompt} color="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-100" />
              <ReviewForm
                feedbackId={row.feedback_id}
                initialStatus={row.status ?? "pending_review"}
                initialNotes={row.instructor_notes ?? ""}
              />
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}

function Block({ label, text, color }: { label: string; text: string | null; color: string }) {
  if (!text) return null;
  return (
    <div>
      <span className={`badge ${color}`}>{label}</span>
      <p className="mt-1 leading-relaxed whitespace-pre-wrap">{text}</p>
    </div>
  );
}
