import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import PeerReviewForm from "./form";

interface Row {
  id: number;
  reviewer_id: number;
  status: string;
  content: string | null;
  score: number | null;
  submission_id: number;
  submitted_content: string;
  assignment_title: string;
  assignment_prompt: string;
  rubric: string;
  author_name: string;
}

export default async function PeerReviewDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pid = Number(id);
  if (!Number.isFinite(pid)) notFound();

  const user = (await getCurrentUser())!;
  const row = db
    .prepare(
      `SELECT pr.id, pr.reviewer_id, pr.status, pr.content, pr.score,
              s.id AS submission_id, s.content AS submitted_content,
              a.title AS assignment_title, a.prompt AS assignment_prompt, a.rubric,
              u.full_name AS author_name
       FROM peer_reviews pr
       JOIN submissions s ON s.id = pr.submission_id
       JOIN assignments a ON a.id = s.assignment_id
       JOIN users u ON u.id = s.user_id
       WHERE pr.id = ?`,
    )
    .get(pid) as Row | undefined;
  if (!row || row.reviewer_id !== user.id) notFound();

  return (
    <div className="min-h-screen">
      <Header
        title={`Peer Review: ${row.assignment_title}`}
        fullName={user.full_name}
        role="student"
      />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6">
        <Link
          href="/student/peer-reviews"
          className="text-sm text-brand-600 hover:underline"
        >
          ← Danh sách peer review
        </Link>

        <div className="card p-4 sm:p-5 mt-3 mb-4">
          <p className="text-xs text-slate-500">
            Bài làm của: <strong>{row.author_name}</strong>
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-slate-600">
              Đề bài & Rubric
            </summary>
            <p className="text-xs text-slate-600 whitespace-pre-wrap mt-2">
              <strong>Đề:</strong> {row.assignment_prompt}
            </p>
            <p className="text-xs text-slate-600 whitespace-pre-wrap mt-2">
              <strong>Rubric:</strong> {row.rubric}
            </p>
          </details>
          <h3 className="font-semibold mt-3 mb-2">Bài làm</h3>
          <div className="p-3 rounded bg-slate-50 dark:bg-slate-800/50 whitespace-pre-wrap text-sm font-mono">
            {row.submitted_content}
          </div>
        </div>

        <PeerReviewForm
          peerReviewId={pid}
          status={row.status}
          initialContent={row.content ?? ""}
          initialScore={row.score}
        />
      </main>
    </div>
  );
}
