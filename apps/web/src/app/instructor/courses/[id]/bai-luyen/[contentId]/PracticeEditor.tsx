"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { UNPLAYABLE_TYPE_BADGE, UNPLAYABLE_TYPE_HINT, isPlayableExamQuestionType } from "@/lib/examQuestionSupport";
import { renderDoc, type TiptapDoc } from "@/components/exam/PassageView";
import PassageEditor from "../../exams/[examId]/PassageEditor";
import QuestionEditor from "../../exams/[examId]/QuestionEditor";

interface PassageData {
  id: string;
  title: string;
  contentJson: unknown;
  audioPolicy: "free_replay" | "limited_replay" | "once_only";
  maxAudioPlays: number | null;
  revealMode: "all_at_once" | "sequential";
  orderIndex: number;
}
interface QuestionData {
  id: string;
  type: string;
  prompt: string;
  points: number;
  passageId: string | null;
  config: Record<string, unknown>;
  orderInExam: number;
  orderInPassage: number | null;
}

const TYPE_LABEL: Record<string, string> = {
  mcq: "Một đáp án",
  multi: "Nhiều đáp án",
  true_false_notgiven: "Đúng/Sai/Không có thông tin",
  gap_fill: "Điền khuyết",
  short_answer: "Trả lời ngắn",
  ordering: "Sắp xếp",
  matching: "Ghép cặp",
  numerical: "Số",
  drag_drop_fill: "Kéo thả điền",
  essay: "Tự luận",
};

type Editing =
  | { kind: "none" }
  | { kind: "passage-new" }
  | { kind: "passage-edit"; id: string }
  | { kind: "question-new"; passageId: string | null }
  | { kind: "question-edit"; id: string };

/** Chữ thô của câu hỏi (prompt có thể là HTML) để hiện một dòng tóm tắt. */
function plain(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Editor Bài luyện: đoạn văn (kèm ảnh, âm thanh) và câu hỏi. Dùng lại trình soạn đoạn và câu hỏi của đề thi nhưng ở chế độ
 * `practiceMode` (không có điểm, skill; câu tự luận có bài mẫu, audio mẫu, tiêu chí cho AI và công tắc giọng nói / AI). Mọi thay đổi ghi qua API của đề ẩn gắn với khối.
 */
export default function PracticeEditor({
  examId,
  sectionId,
  passages,
  questions,
}: {
  examId: string;
  sectionId: string;
  passages: PassageData[];
  questions: QuestionData[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>({ kind: "none" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orderedPassages = [...passages].sort((a, b) => a.orderIndex - b.orderIndex);
  const inPassage = (pid: string) =>
    questions.filter((q) => q.passageId === pid).sort((a, b) => (a.orderInPassage ?? 0) - (b.orderInPassage ?? 0));
  const loose = questions.filter((q) => !q.passageId).sort((a, b) => a.orderInExam - b.orderInExam);
  const total = questions.length;

  async function call(method: "POST" | "DELETE", url: string, body?: unknown): Promise<boolean> {
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(url), {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(`Không thực hiện được (${(d as { error?: string }).error ?? res.status}).`);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Không kết nối được tới máy chủ.");
      return false;
    } finally {
      setWorking(false);
    }
  }

  function move<T extends { id: string }>(list: T[], i: number, dir: -1 | 1): string[] | null {
    const j = i + dir;
    if (j < 0 || j >= list.length) return null;
    const ids = list.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    return ids;
  }

  async function movePassage(i: number, dir: -1 | 1) {
    const ids = move(orderedPassages, i, dir);
    if (ids) await call("POST", `/api/exams/${examId}/passages/reorder`, { orderedPassageIds: ids });
  }
  async function moveQuestion(list: QuestionData[], i: number, dir: -1 | 1, passageId: string | null) {
    const ids = move(list, i, dir);
    if (ids) await call("POST", `/api/exams/${examId}/questions/reorder`, { passageId, orderedQuestionIds: ids });
  }
  async function removePassage(p: PassageData) {
    const n = inPassage(p.id).length;
    const msg =
      n > 0
        ? `Xoá đoạn “${p.title || "(không tên)"}” cùng ${n} câu hỏi của đoạn? Kết quả luyện tập của học viên với các câu này cũng bị xoá và không hoàn tác được.`
        : `Xoá đoạn “${p.title || "(không tên)"}”?`;
    if (window.confirm(msg)) await call("DELETE", `/api/passages/${p.id}`);
  }
  async function removeQuestion(q: QuestionData) {
    if (window.confirm("Xoá câu hỏi này? Kết quả luyện tập của học viên với câu này cũng bị xoá và không hoàn tác được.")) {
      await call("DELETE", `/api/exam-questions/${q.id}`);
    }
  }

  function questionRow(q: QuestionData, list: QuestionData[], i: number, passageId: string | null) {
    if (editing.kind === "question-edit" && editing.id === q.id) {
      return (
        <QuestionEditor
          mode="edit"
          examId={examId}
          passageId={q.passageId}
          sectionId={sectionId}
          questionId={q.id}
          initial={{ type: q.type, prompt: q.prompt, points: q.points, config: q.config, skills: [] }}
          onClose={() => setEditing({ kind: "none" })}
          practiceMode
        />
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm">
        <span className="chip">{TYPE_LABEL[q.type] ?? q.type}</span>
        {!isPlayableExamQuestionType(q.type) && (
          <span className="chip bg-amber-100 text-amber-800" title={UNPLAYABLE_TYPE_HINT}>
            {UNPLAYABLE_TYPE_BADGE} — nên đổi loại
          </span>
        )}
        <span className="min-w-0 basis-full break-words sm:basis-0 sm:flex-1">{plain(q.prompt) || <em className="text-faint">(chưa có đề)</em>}</span>
        <span className="flex shrink-0 flex-wrap items-center gap-1">
          <button type="button" className="btn-ghost btn-sm" aria-label="Lên" disabled={working || i === 0} onClick={() => void moveQuestion(list, i, -1, passageId)}>
            <ArrowUp size={14} aria-hidden />
          </button>
          <button type="button" className="btn-ghost btn-sm" aria-label="Xuống" disabled={working || i === list.length - 1} onClick={() => void moveQuestion(list, i, 1, passageId)}>
            <ArrowDown size={14} aria-hidden />
          </button>
          <button type="button" className="btn-ghost btn-sm" disabled={working} onClick={() => setEditing({ kind: "question-edit", id: q.id })}>
            <Pencil size={14} aria-hidden /> Sửa
          </button>
          <button type="button" className="btn-ghost btn-sm text-danger-600" disabled={working} onClick={() => void removeQuestion(q)}>
            <Trash2 size={14} aria-hidden /> Xoá
          </button>
        </span>
      </div>
    );
  }

  const addingQuestionTo = (pid: string | null) => editing.kind === "question-new" && editing.passageId === pid;

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <div role="alert" className="banner-danger">
          {error}
        </div>
      )}

      {total === 0 && orderedPassages.length === 0 && editing.kind === "none" && (
        <div className="rounded-2xl border border-dashed border-token p-8 text-center">
          <BookOpen className="mx-auto text-faint" size={28} aria-hidden />
          <p className="text-h4 mt-2">Bài luyện chưa có nội dung</p>
          <p className="text-meta mx-auto mt-1 max-w-md">Học viên chỉ thấy bài luyện khi có ít nhất một câu hỏi. Bắt đầu bằng cách thêm một đoạn văn (hoặc bài nghe), rồi thêm câu hỏi cho đoạn.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary btn-sm inline-flex items-center gap-1.5" onClick={() => setEditing({ kind: "passage-new" })}>
              <Plus size={14} aria-hidden /> Thêm đoạn văn / bài nghe
            </button>
            <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1.5" onClick={() => setEditing({ kind: "question-new", passageId: null })}>
              <Plus size={14} aria-hidden /> Thêm câu hỏi
            </button>
          </div>
        </div>
      )}

      {orderedPassages.map((p, pi) => {
        const qs = inPassage(p.id);
        const doc = p.contentJson as TiptapDoc | null;
        if (editing.kind === "passage-edit" && editing.id === p.id) {
          return (
            <PassageEditor
              key={p.id}
              mode="edit"
              examId={examId}
              passageId={p.id}
              initial={{ title: p.title, contentJson: p.contentJson, audioPolicy: p.audioPolicy, maxAudioPlays: p.maxAudioPlays, revealMode: p.revealMode, skills: [] }}
              onClose={() => setEditing({ kind: "none" })}
              practiceMode
            />
          );
        }
        return (
          <section key={p.id} className="rounded-2xl border border-token bg-[rgb(var(--surface-muted))] p-4" aria-label={p.title || `Đoạn ${pi + 1}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-h3 min-w-0 basis-full sm:basis-0 sm:flex-1">{p.title || `Đoạn ${pi + 1}`}</h2>
              <button type="button" className="btn-ghost btn-sm" aria-label="Đưa đoạn lên" disabled={working || pi === 0} onClick={() => void movePassage(pi, -1)}>
                <ArrowUp size={14} aria-hidden />
              </button>
              <button type="button" className="btn-ghost btn-sm" aria-label="Đưa đoạn xuống" disabled={working || pi === orderedPassages.length - 1} onClick={() => void movePassage(pi, 1)}>
                <ArrowDown size={14} aria-hidden />
              </button>
              <button type="button" className="btn-ghost btn-sm" disabled={working} onClick={() => setEditing({ kind: "passage-edit", id: p.id })}>
                <Pencil size={14} aria-hidden /> Sửa đoạn
              </button>
              <button type="button" className="btn-ghost btn-sm text-danger-600" disabled={working} onClick={() => void removePassage(p)}>
                <Trash2 size={14} aria-hidden /> Xoá đoạn
              </button>
            </div>
            {doc && doc.content?.length ? (
              <div className="prose prose-sm mt-3 max-w-none rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2">{renderDoc(doc)}</div>
            ) : (
              <p className="text-meta mt-3 text-faint">Đoạn chưa có nội dung.</p>
            )}
            <div className="mt-3 space-y-2">
              {qs.map((q, i) => (
                <div key={q.id}>{questionRow(q, qs, i, p.id)}</div>
              ))}
              {addingQuestionTo(p.id) ? (
                <QuestionEditor mode="create" examId={examId} passageId={p.id} sectionId={sectionId} onClose={() => setEditing({ kind: "none" })} practiceMode />
              ) : (
                <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1.5" disabled={working} onClick={() => setEditing({ kind: "question-new", passageId: p.id })}>
                  <Plus size={14} aria-hidden /> Thêm câu hỏi vào đoạn này
                </button>
              )}
            </div>
          </section>
        );
      })}

      {editing.kind === "passage-new" && <PassageEditor mode="create" examId={examId} onClose={() => setEditing({ kind: "none" })} practiceMode />}

      {(loose.length > 0 || addingQuestionTo(null)) && (
        <section className="rounded-2xl border border-token p-4" aria-label="Câu hỏi không thuộc đoạn nào">
          <h2 className="text-h3">Câu hỏi không thuộc đoạn nào</h2>
          <div className="mt-3 space-y-2">
            {loose.map((q, i) => (
              <div key={q.id}>{questionRow(q, loose, i, null)}</div>
            ))}
            {addingQuestionTo(null) && (
              <QuestionEditor mode="create" examId={examId} passageId={null} sectionId={sectionId} onClose={() => setEditing({ kind: "none" })} practiceMode />
            )}
          </div>
        </section>
      )}

      {(total > 0 || orderedPassages.length > 0) && editing.kind === "none" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary btn-sm inline-flex items-center gap-1.5" disabled={working} onClick={() => setEditing({ kind: "passage-new" })}>
            <Plus size={14} aria-hidden /> Thêm đoạn văn / bài nghe
          </button>
          <button type="button" className="btn-secondary btn-sm inline-flex items-center gap-1.5" disabled={working} onClick={() => setEditing({ kind: "question-new", passageId: null })}>
            <Plus size={14} aria-hidden /> Thêm câu hỏi không thuộc đoạn
          </button>
        </div>
      )}
    </div>
  );
}
