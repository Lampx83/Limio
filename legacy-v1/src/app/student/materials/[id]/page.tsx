import { notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import Header from "@/components/Header";
import VideoMaterial from "./video";
import PdfMaterial from "./pdf";
import QuizMaterial from "./quiz";
import EmbedMaterial from "./embed";
import Discussion, { type DiscussionPost } from "./discussion";

interface MaterialRow {
  id: number;
  module_id: number;
  type: "video" | "pdf" | "quiz" | "slides" | "file" | "link" | "poll" | "discussion";
  title: string;
  description: string | null;
  video_url: string | null;
  pdf_url: string | null;
  reading_text: string | null;
  quiz_data: string | null;
  external_url: string | null;
  duration_min: number | null;
  module_title: string;
}
interface InteractionRow {
  id: number;
  data: string | null;
  score: number | null;
  completed_at: string;
}
interface FeedbackRow {
  id: number;
  summary: string;
  strengths: string;
  gaps: string;
  next_steps: string;
  metacog_prompt: string;
  condition: string;
  created_at: string;
}

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mid = Number(id);
  if (!Number.isFinite(mid)) notFound();

  const user = (await getCurrentUser())!;

  const m = db
    .prepare(
      `SELECT lm.id, lm.module_id, lm.type, lm.title, lm.description,
              lm.video_url, lm.pdf_url, lm.reading_text, lm.quiz_data, lm.external_url,
              lm.duration_min, mo.title AS module_title
       FROM learning_materials lm
       JOIN modules mo ON mo.id = lm.module_id
       WHERE lm.id = ?`,
    )
    .get(mid) as MaterialRow | undefined;
  if (!m) notFound();

  const interaction = db
    .prepare(
      "SELECT id, data, score, completed_at FROM material_interactions WHERE user_id = ? AND material_id = ?",
    )
    .get(user.id, mid) as InteractionRow | undefined;

  const feedback = interaction
    ? (db
        .prepare(
          "SELECT id, summary, strengths, gaps, next_steps, metacog_prompt, condition, created_at FROM material_feedbacks WHERE interaction_id = ?",
        )
        .get(interaction.id) as FeedbackRow | undefined)
    : undefined;

  function safeParse(s: string | null): Record<string, unknown> {
    if (!s) return {};
    try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
  }
  const interactionData = interaction ? safeParse(interaction.data) : {};
  const initialReflection = (interactionData.reflection as string) ?? "";
  const quizDetail = m.type === "quiz"
    ? (interactionData.detail as Array<{
        q: string;
        chosen_text: string;
        correct_text: string;
        is_correct: boolean;
        explanation?: string;
      }> | undefined)
    : undefined;

  return (
    <div className="min-h-screen">
      <Header
        title={m.title}
        fullName={user.full_name}
        role="student"
      />
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <Link
          href={`/student/modules/${m.module_id}`}
          className="text-sm text-brand-600 hover:underline"
        >
          ← {m.module_title}
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold mt-2 mb-1">{m.title}</h1>
        {m.description && (
          <p className="text-sm sm:text-base text-slate-600 mb-4">{m.description}</p>
        )}

        {m.type === "video" && (
          <VideoMaterial
            materialId={m.id}
            videoUrl={m.video_url ?? ""}
            initialDone={!!interaction}
            initialReflection={initialReflection}
            initialFeedback={feedback ?? null}
          />
        )}
        {m.type === "pdf" && (
          <PdfMaterial
            materialId={m.id}
            readingText={m.reading_text ?? ""}
            pdfUrl={m.pdf_url ?? null}
            initialDone={!!interaction}
            initialReflection={initialReflection}
            initialFeedback={feedback ?? null}
          />
        )}
        {m.type === "quiz" && (
          <QuizMaterial
            materialId={m.id}
            quizData={JSON.parse(m.quiz_data ?? "[]")}
            initialScore={interaction?.score ?? null}
            initialDetail={quizDetail ?? null}
            initialReflection={initialReflection}
            initialFeedback={feedback ?? null}
          />
        )}
        {(m.type === "slides" || m.type === "file" || m.type === "link") && (
          <EmbedMaterial
            materialId={m.id}
            url={m.external_url ?? ""}
            kind={m.type}
            initialDone={!!interaction}
            initialReflection={initialReflection}
            initialFeedback={feedback ?? null}
          />
        )}
        {m.type === "discussion" && (() => {
          const posts = db
            .prepare(
              `SELECT dp.id, dp.parent_id, dp.content, dp.created_at,
                      u.full_name AS author_name,
                      CASE WHEN u.role = 'instructor' THEN 1 ELSE 0 END AS is_instructor
               FROM discussion_posts dp
               JOIN users u ON u.id = dp.user_id
               WHERE dp.material_id = ?
               ORDER BY dp.created_at`,
            )
            .all(m.id) as DiscussionPost[];
          return (
            <Discussion
              materialId={m.id}
              posts={posts}
              currentUserName={user.full_name.split(" ").slice(-1)[0] ?? "Bạn"}
            />
          );
        })()}
      </main>
    </div>
  );
}
