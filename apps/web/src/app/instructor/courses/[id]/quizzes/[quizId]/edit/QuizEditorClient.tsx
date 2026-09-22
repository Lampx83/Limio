"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ListChecks, Pencil, Settings2, Sparkles, Upload, X } from "lucide-react";
import { QuizActionButtons, QuizEditForm } from "../../../QuizHeader";
import EditQuestionForm from "../../../EditQuestionForm";
import AddQuestionForm from "../../../AddQuestionForm";
import ImportMcqModal from "@/components/instructor/ImportMcqModal";
import { apiUrl } from "@/lib/apiUrl";
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
 * Cả 3 lối nhập câu hỏi (AI import / Excel import / Nhập thủ công) đều là
 * POPUP — không còn tab đổi nội dung khung chính như trước. Khung chính bên
 * phải CHỈ còn việc xem/sửa 1 câu đã có (EditQuestionForm) hoặc trạng thái
 * rỗng khi quiz chưa có câu nào. Sidebar chỉ là danh sách câu hỏi, không có
 * nút thêm — thêm câu luôn đi qua 1 trong 3 popup, lưu xong tự đóng popup +
 * router.refresh() để danh sách bên sidebar cập nhật câu vừa lưu.
 *
 * `selected` = id câu đang xem/sửa. `manualKey` tăng mỗi lần mở popup "Nhập
 * thủ công" để form bên trong luôn mount mới (không giữ state của lần trước).
 *
 * LƯU Ý: 2 popup (ImportMcqModal, popup Nhập thủ công) được đặt NGOÀI
 * `<main>` — `<main>` có rule `[&>div]:!bg-transparent` để xoá viền/nền thừa
 * của form con (AddQuestionForm/EditQuestionForm), nhưng rule đó vô tình đè
 * luôn nền tối `bg-black/50` của popup nếu popup nằm bên trong `<main>` (bug
 * đã gặp thực tế — nền popup trong suốt, nhìn lẫn với trang phía sau).
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
  const router = useRouter();
  const [selected, setSelected] = useState<string>(quiz.questions[0]?.id ?? "");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<"file" | "ai">("file");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualKey, setManualKey] = useState(0);

  const totalPoints = quiz.questions.reduce((a, q) => a + q.points, 0);
  const current = quiz.questions.find((q) => q.id === selected) ?? null;
  const backHref = lessonId
    ? `/instructor/courses/${courseId}?tab=content&lesson=${lessonId}`
    : `/instructor/courses/${courseId}?tab=content`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 [--text-faint:96_106_126] [--border:208_211_222]">
      <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-sm">
        <header className="flex flex-wrap items-center gap-3 border-b border-token px-5 py-4">
          <Link
            href={backHref}
            aria-label="Quay lại bài học"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--surface-muted))] text-muted transition-colors hover:bg-brand-soft hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <ListChecks className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-default">{quiz.title}</h1>
            {lessonTitle && (
              <p className="truncate text-sm text-muted">Bài: {lessonTitle}</p>
            )}
          </div>
          {quiz.isHidden && <span className="chip-danger">Đang ẩn</span>}
          <QuizActionButtons quiz={quiz} />
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-token bg-[rgb(var(--surface-muted))] px-5 py-3">
          <span className="rounded-full bg-[rgb(var(--surface))] px-3 py-1 text-xs text-muted">
            Độ khó <b className="font-semibold text-default">{quiz.difficulty ?? "—"}/5</b>
          </span>
          <span className="rounded-full bg-[rgb(var(--surface))] px-3 py-1 text-xs text-muted">
            {quiz.timeLimitSec ? `${Math.round(quiz.timeLimitSec / 60)} phút` : "Không giới hạn"}
          </span>
          <span className="rounded-full bg-[rgb(var(--surface))] px-3 py-1 text-xs text-muted">
            Confidence <b className="font-semibold text-default">{quiz.requireConfidence ? "Bật" : "Tắt"}</b>
          </span>
          <span className="chip-brand ml-auto">
            {quiz.questions.length} câu · {totalPoints} điểm
          </span>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium text-muted hover:bg-brand-soft hover:text-brand-700"
          >
            <Settings2 className="h-3.5 w-3.5" /> Cài đặt
          </button>
        </div>
        {settingsOpen && (
          <div className="border-b border-token px-5 py-4">
            <QuizEditForm quiz={quiz} onClose={() => setSettingsOpen(false)} />
          </div>
        )}

        {/* Toolbar — 3 lối nhập câu hỏi, đều mở popup. Đặt ở đây (ngoài
            <main>) để không bị rule [&>div]:!bg-transparent của <main> đè
            mất nền của popup (xem comment đầu file). Icon-trong-vòng-tròn +
            shadow + hover lift cho hiện đại, nhưng GIỮ NGUYÊN quy ước đã
            chốt qua nhiều vòng feedback: 3 nút trung tính đồng nhất, chỉ
            icon AI import tô màu tím — đừng tô màu nền/viền riêng cho từng
            nút. */}
        <div className="border-b border-token bg-[rgb(var(--surface-muted))] px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
            Thêm câu hỏi
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setImportMode("ai");
                setImportOpen(true);
              }}
              className="inline-flex min-w-[152px] items-center gap-2 rounded-xl border border-token bg-white px-3 py-2 text-sm font-medium text-muted shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700 hover:shadow-md"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
              </span>
              AI import
            </button>
            <button
              type="button"
              onClick={() => {
                setImportMode("file");
                setImportOpen(true);
              }}
              className="inline-flex min-w-[152px] items-center gap-2 rounded-xl border border-token bg-white px-3 py-2 text-sm font-medium text-muted shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700 hover:shadow-md"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-muted))] text-muted">
                <Upload className="h-3.5 w-3.5" aria-hidden />
              </span>
              Excel import
            </button>
            <button
              type="button"
              onClick={() => {
                setManualKey((k) => k + 1);
                setManualOpen(true);
              }}
              className="inline-flex min-w-[152px] items-center gap-2 rounded-xl border border-token bg-white px-3 py-2 text-sm font-medium text-muted shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-soft hover:text-brand-700 hover:shadow-md"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-muted))] text-muted">
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </span>
              Nhập thủ công
            </button>
          </div>
        </div>

        <div className="grid lg:min-h-[560px] lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-token bg-[rgb(var(--surface))] p-3 lg:sticky lg:top-4 lg:self-start lg:border-b-0 lg:border-r lg:min-h-[560px]">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-faint">
              Câu hỏi ({quiz.questions.length})
            </p>
            <ol className="space-y-1">
              {quiz.questions.map((q, i) => {
                const on = q.id === selected;
                return (
                  <li key={q.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(q.id)}
                      className={`flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                        on
                          ? "border-brand-300 bg-brand-soft"
                          : "border-transparent hover:bg-[rgb(var(--surface-muted))]"
                      }`}
                    >
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${on ? "bg-brand-600 text-white" : "bg-[rgb(var(--border))] text-muted"}`}>{i + 1}</span>
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
              {quiz.questions.length === 0 && (
                <p className="px-2 py-4 text-center text-xs text-faint">
                  Chưa có câu hỏi nào.
                </p>
              )}
            </ol>
          </aside>

          <main className="min-w-0 bg-[rgb(var(--surface))] p-5 md:p-6 [&>div]:!m-0 [&>div]:!border-0 [&>div]:!bg-transparent [&>div]:!p-0 [&>form]:!border-0 [&>form]:!bg-transparent [&>form]:!p-0">
            {current ? (
              <EditQuestionForm
                key={current.id}
                question={current}
                hideCancel
                onClose={() => {}}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-token p-8 text-center text-sm text-muted">
                Chưa có câu hỏi nào được chọn — bấm AI import / Excel import /
                Nhập thủ công ở trên để bắt đầu.
              </div>
            )}
          </main>
        </div>
      </div>

      <ImportMcqModal
        open={importOpen}
        mode={importMode}
        onClose={() => setImportOpen(false)}
        onCommitted={() => router.refresh()}
        previewEndpoint={apiUrl(`/api/quizzes/${quiz.id}/questions/mcq-import-preview`)}
        commitEndpoint={apiUrl(`/api/quizzes/${quiz.id}/questions/mcq-import-commit`)}
        destinationLabel="quiz"
      />

      {manualOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16"
          onClick={(e) => e.target === e.currentTarget && setManualOpen(false)}
        >
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-default px-5 py-3">
              <h2 className="text-base font-semibold">Nhập thủ công</h2>
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="text-faint hover:text-slate-700"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-y-auto p-5">
              <AddQuestionForm
                key={manualKey}
                quizId={quiz.id}
                nextOrderIndex={quiz.questions.length}
                startOpen
                // AddQuestionForm đã tự router.refresh() khi tạo thành công —
                // ở đây chỉ cần đóng popup.
                onCreated={() => setManualOpen(false)}
                onExit={() => setManualOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
