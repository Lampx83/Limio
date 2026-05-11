"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import PassageEditor from "./PassageEditor";
import QuestionEditor from "./QuestionEditor";

interface Skill {
  id: string;
  code: string;
  name: string;
}

interface PassageData {
  id: string;
  title: string;
  contentJson: unknown;
  audioPolicy: "free_replay" | "limited_replay" | "once_only";
  maxAudioPlays: number | null;
  revealMode: "all_at_once" | "sequential";
  skills: Skill[];
  orderIndex: number;
}

interface QuestionData {
  id: string;
  type: string;
  prompt: string;
  points: number;
  passageId: string | null;
  config: Record<string, unknown>;
  skills: Skill[];
  orderInExam: number;
  orderInPassage: number | null;
}

interface Props {
  examId: string;
  editable: boolean;
  passages: PassageData[];
  questions: QuestionData[];
}

const TYPE_LABEL: Record<string, string> = {
  mcq: "MCQ",
  multi: "MULTI",
  true_false_notgiven: "T/F/NG",
  gap_fill: "Gap fill",
  short_answer: "Trả lời ngắn",
  essay: "Tự luận",
};

type EditState =
  | { kind: "idle" }
  | { kind: "newPassage" }
  | { kind: "editPassage"; passageId: string }
  | { kind: "newQuestion"; passageId: string | null }
  | { kind: "editQuestion"; questionId: string };

export default function ContentManager({ examId, editable, passages, questions }: Props) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditState>({ kind: "idle" });
  const [working, setWorking] = useState(false);
  /** Source index + scope captured at dragstart. Uses ref so it survives the
   *  drag lifecycle without re-renders (state would not update in time). */
  const dragRef = useRef<{ scope: string; from: number } | null>(null);
  /** Visual hover tracking via state so the drop target highlights. */
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  function dragProps(
    scope: string,
    index: number,
    onDropTo: (from: number, to: number) => void,
  ) {
    if (!editable) return {} as const;
    const key = `${scope}:${index}`;
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        dragRef.current = { scope, from: index };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-fb-drag", `${scope}:${index}`);
      },
      onDragOver: (e: React.DragEvent) => {
        const d = dragRef.current;
        if (d && d.scope === scope) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          if (dragOverKey !== key) setDragOverKey(key);
        }
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const d = dragRef.current;
        if (d && d.scope === scope && d.from !== index) {
          onDropTo(d.from, index);
        }
        dragRef.current = null;
        setDragOverKey(null);
      },
      onDragEnd: () => {
        dragRef.current = null;
        setDragOverKey(null);
      },
      className:
        dragOverKey === key
          ? "ring-2 ring-blue-400"
          : "",
    };
  }

  const standalone = questions.filter((q) => q.passageId === null);
  const passageQuestionMap = new Map<string, QuestionData[]>();
  for (const q of questions) {
    if (q.passageId) {
      const arr = passageQuestionMap.get(q.passageId) ?? [];
      arr.push(q);
      passageQuestionMap.set(q.passageId, arr);
    }
  }

  async function api(method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown) {
    setWorking(true);
    const res = await fetch(apiUrl(url), {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setWorking(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(`Thất bại: ${d?.error ?? res.status}`);
      return false;
    }
    router.refresh();
    return true;
  }

  async function reorderPassagesAt(i: number, dir: -1 | 1) {
    const ids = [...passages.map((p) => p.id)];
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await api("POST", `/api/exams/${examId}/passages/reorder`, { orderedPassageIds: ids });
  }

  /** Drag-drop helper — given a list of IDs and source/target indices, persist
   *  the resulting order using the given reorder URL + body shape. */
  async function reorderByDrop(
    list: Array<{ id: string }>,
    from: number,
    to: number,
    url: string,
    bodyKey: "orderedPassageIds" | "orderedQuestionIds",
    extra?: Record<string, unknown>,
  ) {
    if (from === to) return;
    const ids = list.map((x) => x.id);
    const [moved] = ids.splice(from, 1);
    if (moved === undefined) return;
    ids.splice(to, 0, moved);
    await api("POST", url, { [bodyKey]: ids, ...(extra ?? {}) });
  }

  async function reorderQuestionsInScope(
    passageId: string | null,
    list: QuestionData[],
    i: number,
    dir: -1 | 1,
  ) {
    const ids = [...list.map((q) => q.id)];
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    await api("POST", `/api/exams/${examId}/questions/reorder`, {
      passageId,
      orderedQuestionIds: ids,
    });
  }

  async function deletePassage(passageId: string) {
    if (!window.confirm("Xoá đoạn này (và toàn bộ câu hỏi gắn với nó)?")) return;
    await api("DELETE", `/api/passages/${passageId}`);
  }

  async function deleteQuestion(questionId: string) {
    if (!window.confirm("Xoá câu hỏi này?")) return;
    await api("DELETE", `/api/exam-questions/${questionId}`);
  }

  function renderQuestionRow(q: QuestionData, list: QuestionData[], i: number, passageId: string | null) {
    if (edit.kind === "editQuestion" && edit.questionId === q.id) {
      return (
        <QuestionEditor
          mode="edit"
          examId={examId}
          passageId={passageId}
          questionId={q.id}
          initial={{
            type: q.type,
            prompt: q.prompt,
            points: q.points,
            config: q.config,
            skills: q.skills,
          }}
          onClose={() => setEdit({ kind: "idle" })}
        />
      );
    }
    const dp = dragProps(
      `q:${passageId ?? "standalone"}`,
      i,
      (from, to) =>
        reorderByDrop(
          list,
          from,
          to,
          `/api/exams/${examId}/questions/reorder`,
          "orderedQuestionIds",
          { passageId },
        ),
    );
    return (
      <div
        {...dp}
        className={`flex items-center gap-2 rounded border border-default bg-white px-3 py-2 text-sm ${dp.className ?? ""}`}
      >
        {editable && (
          <span className="cursor-grab text-faint" title="Kéo để sắp xếp">
            ⋮⋮
          </span>
        )}
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {TYPE_LABEL[q.type] ?? q.type}
        </span>
        <span className="flex-1 truncate">{q.prompt || <em className="text-faint">(chưa có đề)</em>}</span>
        <span className="text-xs text-faint">{q.points} điểm</span>
        {q.skills.length === 0 && (
          <span
            title="Câu hỏi này chưa có skill — sẽ bị reject khi publish."
            className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
          >
            ⚠ skill
          </span>
        )}
        {editable && (
          <>
            <button
              type="button"
              disabled={working || i === 0}
              onClick={() => reorderQuestionsInScope(passageId, list, i, -1)}
              className="rounded border border-default px-1.5 py-0.5 text-xs disabled:opacity-30"
              aria-label="Lên"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={working || i === list.length - 1}
              onClick={() => reorderQuestionsInScope(passageId, list, i, 1)}
              className="rounded border border-default px-1.5 py-0.5 text-xs disabled:opacity-30"
              aria-label="Xuống"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => setEdit({ kind: "editQuestion", questionId: q.id })}
              className="rounded border border-default px-2 py-0.5 text-xs"
            >
              Sửa
            </button>
            <button
              type="button"
              onClick={() => deleteQuestion(q.id)}
              className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700"
            >
              Xoá
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Passages */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-faint">
            Đoạn bài đọc ({passages.length})
          </h3>
          {editable && edit.kind === "idle" && (
            <button
              type="button"
              onClick={() => setEdit({ kind: "newPassage" })}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white"
            >
              + Thêm đoạn
            </button>
          )}
        </div>

        {edit.kind === "newPassage" && (
          <div className="mb-3">
            <PassageEditor
              mode="create"
              examId={examId}
              onClose={() => setEdit({ kind: "idle" })}
            />
          </div>
        )}

        {passages.length === 0 && edit.kind !== "newPassage" && (
          <p className="rounded border border-dashed border-default px-4 py-6 text-center text-sm text-faint">
            Chưa có đoạn bài đọc nào.
          </p>
        )}

        <ul className="space-y-3">
          {passages.map((p, pi) => {
            const qs = passageQuestionMap.get(p.id) ?? [];
            const isEditing = edit.kind === "editPassage" && edit.passageId === p.id;
            const dp = dragProps("passage", pi, (from, to) =>
              reorderByDrop(
                passages,
                from,
                to,
                `/api/exams/${examId}/passages/reorder`,
                "orderedPassageIds",
              ),
            );
            return (
              <li
                key={p.id}
                {...dp}
                className={`rounded-lg border border-default bg-slate-50 p-3 ${dp.className ?? ""}`}
              >
                {isEditing ? (
                  <PassageEditor
                    mode="edit"
                    examId={examId}
                    passageId={p.id}
                    initial={{
                      title: p.title,
                      contentJson: p.contentJson,
                      audioPolicy: p.audioPolicy,
                      maxAudioPlays: p.maxAudioPlays,
                      revealMode: p.revealMode,
                      skills: p.skills,
                    }}
                    onClose={() => setEdit({ kind: "idle" })}
                  />
                ) : (
                  <>
                    <div className="mb-2 flex items-center gap-2">
                      {editable && (
                        <span className="cursor-grab text-faint" title="Kéo để sắp xếp">
                          ⋮⋮
                        </span>
                      )}
                      <span className="text-xs text-faint">Đoạn {pi + 1}</span>
                      <h4 className="flex-1 truncate font-medium">{p.title}</h4>
                      <span className="text-xs text-faint">{qs.length} câu</span>
                      {editable && (
                        <>
                          <button
                            type="button"
                            disabled={working || pi === 0}
                            onClick={() => reorderPassagesAt(pi, -1)}
                            className="rounded border border-default px-1.5 py-0.5 text-xs disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            disabled={working || pi === passages.length - 1}
                            onClick={() => reorderPassagesAt(pi, 1)}
                            className="rounded border border-default px-1.5 py-0.5 text-xs disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => setEdit({ kind: "editPassage", passageId: p.id })}
                            className="rounded border border-default px-2 py-0.5 text-xs"
                          >
                            Sửa đoạn
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePassage(p.id)}
                            className="rounded border border-red-300 px-2 py-0.5 text-xs text-red-700"
                          >
                            Xoá
                          </button>
                        </>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {qs.map((q, i) => (
                        <li key={q.id}>{renderQuestionRow(q, qs, i, p.id)}</li>
                      ))}
                    </ul>
                    {editable && edit.kind === "newQuestion" && edit.passageId === p.id ? (
                      <div className="mt-2">
                        <QuestionEditor
                          mode="create"
                          examId={examId}
                          passageId={p.id}
                          onClose={() => setEdit({ kind: "idle" })}
                        />
                      </div>
                    ) : editable && edit.kind === "idle" ? (
                      <button
                        type="button"
                        onClick={() => setEdit({ kind: "newQuestion", passageId: p.id })}
                        className="mt-2 rounded border border-dashed border-emerald-400 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                      >
                        + Thêm câu hỏi vào đoạn này
                      </button>
                    ) : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Standalone questions */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-faint">
            Câu hỏi độc lập ({standalone.length})
          </h3>
          {editable && edit.kind === "idle" && (
            <button
              type="button"
              onClick={() => setEdit({ kind: "newQuestion", passageId: null })}
              className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white"
            >
              + Câu hỏi độc lập
            </button>
          )}
        </div>

        {editable && edit.kind === "newQuestion" && edit.passageId === null && (
          <div className="mb-3">
            <QuestionEditor
              mode="create"
              examId={examId}
              passageId={null}
              onClose={() => setEdit({ kind: "idle" })}
            />
          </div>
        )}

        {standalone.length === 0 && (
          <p className="rounded border border-dashed border-default px-4 py-4 text-center text-sm text-faint">
            Không có câu hỏi độc lập.
          </p>
        )}

        <ul className="space-y-1.5">
          {standalone.map((q, i) => (
            <li key={q.id}>{renderQuestionRow(q, standalone, i, null)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
