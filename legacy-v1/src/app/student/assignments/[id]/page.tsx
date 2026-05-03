import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import AssignmentEditor from "./editor";

interface AssignmentRow {
  id: number;
  module_id: number;
  title: string;
  prompt: string;
  learning_objectives: string;
  rubric: string;
  min_words: number;
}

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const aid = Number(id);
  if (!Number.isFinite(aid)) notFound();

  const user = (await getCurrentUser())!;

  const a = db
    .prepare(
      "SELECT id, module_id, title, prompt, learning_objectives, rubric, min_words FROM assignments WHERE id = ?",
    )
    .get(aid) as AssignmentRow | undefined;
  if (!a) notFound();

  // Đã nộp rồi: redirect sang feedback
  const existing = db
    .prepare(
      "SELECT id FROM submissions WHERE assignment_id = ? AND user_id = ?",
    )
    .get(aid, user.id) as { id: number } | undefined;
  if (existing) redirect(`/student/feedback/${existing.id}`);

  return (
    <div className="min-h-screen">
      <Header
        title={a.title}
        fullName={user.full_name}
        role="student"
      />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="card p-6 mb-4">
          <h1 className="text-2xl font-bold mb-3">{a.title}</h1>
          <h3 className="font-semibold text-sm uppercase text-slate-500 mb-1">
            Đề bài
          </h3>
          <p className="text-slate-800 whitespace-pre-wrap mb-4 leading-relaxed">
            {a.prompt}
          </p>
          <h3 className="font-semibold text-sm uppercase text-slate-500 mb-1">
            Mục tiêu học tập
          </h3>
          <p className="text-slate-700 whitespace-pre-wrap mb-4 text-sm">
            {a.learning_objectives}
          </p>
          <details>
            <summary className="cursor-pointer text-sm text-slate-600 font-medium">
              Xem rubric chấm
            </summary>
            <p className="text-slate-700 whitespace-pre-wrap mt-2 text-sm">
              {a.rubric}
            </p>
          </details>
        </div>

        <AssignmentEditor assignmentId={a.id} minWords={a.min_words} moduleId={a.module_id} />
      </main>
    </div>
  );
}
