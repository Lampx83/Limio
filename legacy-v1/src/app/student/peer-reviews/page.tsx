import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Header from "@/components/Header";

interface Row {
  id: number;
  submission_id: number;
  status: string;
  assigned_at: string;
  submitted_at: string | null;
  assignment_title: string;
  author_name: string;
}

export default async function PeerReviewsPage() {
  const user = (await getCurrentUser())!;
  const rows = db
    .prepare(
      `SELECT pr.id, pr.submission_id, pr.status, pr.assigned_at, pr.submitted_at,
              a.title AS assignment_title, u.full_name AS author_name
       FROM peer_reviews pr
       JOIN submissions s ON s.id = pr.submission_id
       JOIN assignments a ON a.id = s.assignment_id
       JOIN users u ON u.id = s.user_id
       WHERE pr.reviewer_id = ?
       ORDER BY pr.status, pr.assigned_at DESC`,
    )
    .all(user.id) as Row[];

  return (
    <div className="min-h-screen">
      <Header
        title="Peer Review"
        fullName={user.full_name}
        role="student"
      />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6">
        <Link href="/student" className="text-sm text-brand-600 hover:underline">
          ← Bảng điều khiển
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold mt-2 mb-4">
          Peer review của tôi
        </h1>
        {rows.length === 0 && (
          <div className="card p-6 text-center text-slate-500 text-sm">
            Bạn không có peer review nào được giao.
          </div>
        )}
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/student/peer-reviews/${r.id}`}
                className="card p-3 sm:p-4 hover:border-brand-400 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{r.assignment_title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Bài của: {r.author_name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Giao: {r.assigned_at}
                  </p>
                </div>
                <div className="shrink-0">
                  {r.status === "submitted" ? (
                    <span className="badge-green">✓ Đã nộp</span>
                  ) : (
                    <span className="badge-amber">Cần làm</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
