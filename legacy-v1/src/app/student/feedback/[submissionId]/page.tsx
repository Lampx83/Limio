import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import MetacogReflection from "./reflection";

interface FeedbackRow {
  submission_id: number;
  user_id: number;
  assignment_id: number;
  module_id: number;
  assignment_title: string;
  content: string;
  word_count: number;
  time_spent_sec: number;
  edit_count: number;
  paste_count: number;
  submitted_at: string;
  feed_up: string | null;
  feed_back_task: string | null;
  feed_back_process: string | null;
  feed_back_self_reg: string | null;
  feed_forward: string | null;
  metacog_prompt: string | null;
  score: number | null;
  status: string | null;
  reviewed_at: string | null;
  instructor_notes: string | null;
  condition: string | null;
}

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const sid = Number(submissionId);
  if (!Number.isFinite(sid)) notFound();

  const user = (await getCurrentUser())!;

  const row = db
    .prepare(
      `SELECT s.id AS submission_id, s.user_id, s.assignment_id, a.module_id,
              a.title AS assignment_title, s.content,
              s.time_spent_sec, s.edit_count, s.paste_count, s.submitted_at,
              f.feed_up, f.feed_back_task, f.feed_back_process, f.feed_back_self_reg,
              f.feed_forward, f.metacog_prompt, f.score, f.status, f.reviewed_at,
              f.instructor_notes, f.condition
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       LEFT JOIN ai_feedbacks f ON f.submission_id = s.id
       WHERE s.id = ?`,
    )
    .get(sid) as FeedbackRow | undefined;

  if (!row || row.user_id !== user.id) notFound();

  const peerReviews = db
    .prepare(
      `SELECT pr.id, pr.content, pr.score, pr.submitted_at, u.full_name AS reviewer
       FROM peer_reviews pr
       JOIN users u ON u.id = pr.reviewer_id
       WHERE pr.submission_id = ? AND pr.status = 'submitted'`,
    )
    .all(sid) as Array<{
    id: number;
    content: string;
    score: number;
    submitted_at: string;
    reviewer: string;
  }>;

  const wordCount = row.content.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.round(row.time_spent_sec / 60);

  return (
    <div className="min-h-screen">
      <Header
        title={`Phản hồi: ${row.assignment_title}`}
        fullName={user.full_name}
        role="student"
      />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href={`/student/modules/${row.module_id}`}
          className="text-sm text-brand-600 hover:underline"
        >
          ← Quay lại module
        </Link>

        <div className="mt-3 mb-6">
          <h1 className="text-2xl font-bold mb-2">{row.assignment_title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>Nộp lúc {row.submitted_at}</span>
            <span>·</span>
            <span>{wordCount} từ</span>
            <span>·</span>
            <span>~{minutes} phút làm</span>
            {row.score !== null && (
              <>
                <span>·</span>
                <span className="badge-blue">
                  Điểm AI: {row.score}/100
                </span>
              </>
            )}
            {row.status === "approved" && (
              <span className="badge-green">Đã được giảng viên duyệt</span>
            )}
          </div>
        </div>

        {!row.feed_up && (
          <div className="card p-5 bg-amber-50 border-amber-300">
            <p className="text-amber-900">
              Phản hồi AI đang được sinh hoặc thất bại. Vui lòng thử lại sau hoặc
              liên hệ giảng viên.
            </p>
          </div>
        )}

        {row.feed_up && (
          <div className="space-y-4">
            <FeedbackBlock
              tag="Feed Up"
              tagColor="bg-blue-100 text-blue-700"
              title="Mục tiêu của bạn"
              text={row.feed_up}
            />
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="badge bg-emerald-100 text-emerald-700">
                  Feed Back
                </span>
                <h3 className="font-semibold">Phản hồi 3 cấp Hattie & Timperley</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500 mb-1">
                    Cấp 1 — Nhiệm vụ (Task)
                  </p>
                  <p className="prose-fb">{row.feed_back_task}</p>
                </div>
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500 mb-1">
                    Cấp 2 — Quá trình (Process)
                  </p>
                  <p className="prose-fb">{row.feed_back_process}</p>
                </div>
                <div>
                  <p className="text-xs uppercase font-semibold text-slate-500 mb-1">
                    Cấp 3 — Tự điều chỉnh (Self-regulation)
                  </p>
                  <p className="prose-fb">{row.feed_back_self_reg}</p>
                </div>
              </div>
            </div>
            <FeedbackBlock
              tag="Feed Forward"
              tagColor="bg-violet-100 text-violet-700"
              title="Bước tiếp theo"
              text={row.feed_forward ?? ""}
            />
            {row.instructor_notes && (
              <div className="card p-5 bg-amber-50 border-amber-300">
                <h3 className="font-semibold text-amber-900 mb-1">
                  Ghi chú từ giảng viên
                </h3>
                <p className="text-sm text-amber-900 whitespace-pre-wrap">
                  {row.instructor_notes}
                </p>
              </div>
            )}
            <MetacogReflection
              submissionId={sid}
              prompt={row.metacog_prompt ?? ""}
            />
          </div>
        )}

        {peerReviews.length > 0 && (
          <section className="mt-6">
            <h2 className="text-base sm:text-lg font-semibold mb-2">
              💬 Phản hồi từ bạn học (Peer Review)
            </h2>
            <ul className="space-y-2">
              {peerReviews.map((pr) => (
                <li
                  key={pr.id}
                  className="card p-3 sm:p-4 border-pink-300 bg-pink-50 dark:bg-pink-900/20"
                >
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <p className="font-medium text-sm">— {pr.reviewer}</p>
                    <span className="badge-blue">{pr.score}/100</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{pr.content}</p>
                  <p className="text-xs text-slate-500 mt-1">{pr.submitted_at}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-slate-600">
            Xem lại bài đã nộp
          </summary>
          <div className="card p-4 mt-2 whitespace-pre-wrap text-sm font-mono">
            {row.content}
          </div>
        </details>
      </main>
    </div>
  );
}

function FeedbackBlock({
  tag,
  tagColor,
  title,
  text,
}: {
  tag: string;
  tagColor: string;
  title: string;
  text: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={`badge ${tagColor}`}>{tag}</span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm prose-fb whitespace-pre-wrap">{text}</p>
    </div>
  );
}
