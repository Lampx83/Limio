"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Plus, Settings2 } from "lucide-react";
import { QuizActionButtons, QuizEditForm } from "../../../QuizHeader";
import EditQuestionForm from "../../../EditQuestionForm";
import AddQuestionForm from "../../../AddQuestionForm";
import AiQuestionGenerator from "../../../AiQuestionGenerator";
import BulkImportQuestions from "../../../BulkImportQuestions";
import { plainToRichHtml } from "@/lib/richText";

interface Question {
  id: string;
  type: string;
  prompt: string;
  points: number;
  orderIndex: number;
  explanation: string | null;
  extra: unknown;
  options: Array<{
    id: string;
    label: string;
    isCorrect: boolean;
    orderIndex: number;
    misconceptionId: string | null;
    misconception: { id: string; code: string; name: string } | null;
    extra: unknown;
  }>;
  skillTags: Array<{ skillId: string; skill: { code: string; name: string } }>;
}

interface Quiz {
  id: string;
  title: string;
  difficulty: number | null;
  requireConfidence: boolean;
  timeLimitSec: number | null;
  maxAttempts: number | null;
  isHidden: boolean;
  questions: Question[];
}

const TYPE_LABEL: Record<string, string> = {
  mcq: "Trắc nghiệm",
  true_false: "Đúng / Sai",
  fill_in: "Điền khuyết",
  ordering: "Sắp xếp thứ tự",
  matching: "Ghép cặp",
  numerical: "Đáp án dạng số",
  essay: "Tự luận",
  short_answer: "Trả lời ngắn",
  drag_drop_fill: "Kéo thả từ/câu",
};

function stripHtml(html: string): string {
  return plainToRichHtml(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trình soạn quiz toàn trang. Không tự viết lại form câu hỏi — dùng lại đúng
 * AddQuestionForm (bộ chọn loại + form) và EditQuestionForm, chỉ đổi khung bao.
 *
 * `selected` = id câu đang sửa, hoặc "new" khi đang thêm. `addKey` tăng sau mỗi
 * lần tạo xong để AddQuestionForm mount lại và mở lại bộ chọn cho câu kế tiếp
 * (nhập liền tay nhiều câu).
 */
export default function QuizEditorClient({
  courseId,
  lessonId,
  lessonTitle,
  quiz,
}: {
  courseId: string;
  lessonId: string | null;
  lessonTitle: string | null;
  quiz: Quiz;
}) {
  const [selected, setSelected] = useState<string>(
    quiz.questions[0]?.id ?? "new",
  );
  const [addKey, setAddKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Công cụ nhập hàng loạt / AI mở ở vùng giữa, thay cho form soạn (không chen lên đầu trang).
  const [tool, setTool] = useState<null | "import" | "ai">(null);

  const totalPoints = quiz.questions.reduce((a, q) => a + q.points, 0);
  const current = quiz.questions.find((q) => q.id === selected) ?? null;
  const backHref = lessonId
    ? `/instructor/courses/${courseId}?tab=content&lesson=${lessonId}`
    : `/instructor/courses/${courseId}?tab=content`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 [--text-faint:96_106_126] [--border:208_211_222]">
      <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-sm">
        <header className="flex flex-wrap items-center gap-3 border-b border-token px-4 py-3">
          <Link
            href={backHref}
            aria-label="Quay lại bài học"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-brand-soft hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-h3 font-semibold">{quiz.title}</h1>
            {lessonTitle && (
              <p className="truncate text-sm text-muted">Bài: {lessonTitle}</p>
            )}
          </div>
          {quiz.isHidden && <span className="chip">Đang ẩn</span>}
          <QuizActionButtons quiz={quiz} />
        </header>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-token bg-[rgb(var(--surface-muted))] px-4 py-2.5 text-sm text-muted">
          <span>Độ khó <b className="font-semibold text-default">{quiz.difficulty ?? "—"}/5</b></span>
          <span>
            Thời gian{" "}
            <b className="font-semibold text-default">
              {quiz.timeLimitSec ? `${Math.round(quiz.timeLimitSec / 60)} phút` : "Không giới hạn"}
            </b>
          </span>
          <span>Confidence <b className="font-semibold text-default">{quiz.requireConfidence ? "Bật" : "Tắt"}</b></span>
          <span className="ml-auto">
            Tổng <b className="font-semibold text-default">{quiz.questions.length} câu · {totalPoints} điểm</b>
          </span>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium hover:bg-brand-soft hover:text-brand-700"
          >
            <Settings2 className="h-3.5 w-3.5" /> Cài đặt
          </button>
        </div>
        {settingsOpen && (
          <div className="border-b border-token px-4 py-3">
            <QuizEditForm quiz={quiz} onClose={() => setSettingsOpen(false)} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-token px-4 py-2.5">
          {lessonId && (
            <AiQuestionGenerator
              quizId={quiz.id}
              lessonId={lessonId}
              nextOrderIndex={quiz.questions.length}
              open={false}
              onOpenChange={(o) => o && setTool("ai")}
            />
          )}
          <BulkImportQuestions
            quizId={quiz.id}
            open={false}
            onOpenChange={(o) => o && setTool("import")}
          />
        </div>

        <div className="grid min-h-[560px] lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-token bg-[rgb(var(--surface-muted))] p-3 lg:sticky lg:top-4 lg:self-start lg:border-b-0 lg:border-r lg:min-h-[560px]">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-faint">
              Câu hỏi ({quiz.questions.length})
            </p>
            <ol className="space-y-1">
              {quiz.questions.map((q, i) => {
                const on = tool === null && q.id === selected;
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setTool(null);
                        setSelected(q.id);
                      }}
                      className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        on
                          ? "border-brand-400 bg-[rgb(var(--surface))] shadow-sm"
                          : "border-transparent hover:border-token hover:bg-[rgb(var(--surface))]"
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${on ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-600"}`}>{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-sm font-medium text-default">{stripHtml(q.prompt) || "Câu hỏi trống"}</span>
                        <span className="block text-xs text-muted">
                          {TYPE_LABEL[q.type] ?? q.type} · {q.points} điểm
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {tool === null && selected === "new" && (
                <li className="flex items-center gap-2 rounded-lg border border-brand-400 bg-[rgb(var(--surface))] px-2.5 py-2 text-sm font-medium text-default shadow-sm">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold tabular-nums text-white">{quiz.questions.length + 1}</span>
                  Câu mới…
                </li>
              )}
            </ol>
            <button
              type="button"
              onClick={() => {
                setTool(null);
                setAddKey((k) => k + 1);
                setSelected("new");
              }}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-token py-2 text-sm font-medium text-muted hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700"
            >
              <Plus className="h-4 w-4" /> Thêm câu hỏi
            </button>
          </aside>

          <main className="min-w-0 bg-[rgb(var(--surface))] p-5 md:p-6 [&>div]:!m-0 [&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!p-0 [&>form]:!border-0 [&>form]:!bg-transparent [&>form]:!p-0">
            {tool === "import" ? (
              <BulkImportQuestions quizId={quiz.id} open onOpenChange={(o) => !o && setTool(null)} />
            ) : tool === "ai" && lessonId ? (
              <AiQuestionGenerator
                quizId={quiz.id}
                lessonId={lessonId}
                nextOrderIndex={quiz.questions.length}
                open
                onOpenChange={(o) => !o && setTool(null)}
              />
            ) : selected === "new" || !current ? (
              <AddQuestionForm
                key={addKey}
                quizId={quiz.id}
                nextOrderIndex={quiz.questions.length}
                startOpen
                onCreated={() => setAddKey((k) => k + 1)}
                onExit={() => {
                  const last = quiz.questions[quiz.questions.length - 1];
                  if (last) setSelected(last.id);
                }}
              />
            ) : (
              <EditQuestionForm
                key={current.id}
                question={current}
                hideCancel
                onClose={() => {}}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
