"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, MoreHorizontal, PenLine, Plus } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import PassageEditor from "./PassageEditor";
import QuestionEditor from "./QuestionEditor";
import { renderDoc, type TiptapDoc } from "@/components/exam/PassageView";
import ImportQuestionsModal from "./ImportQuestionsModal";
import BankPickerModal from "./BankPickerModal";

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
  /** Mã từ bank gốc (vd "KNM-0042") nếu câu được copy/import từ ngân hàng. */
  bankCode?: string | null;
  /** Phần (ExamSection) câu hỏi này thuộc về — null = chưa gán, hiển thị dưới "Phần 1" ngầm định. */
  sectionId?: string | null;
}

interface SectionSummary {
  id: string;
  title: string;
  orderIndex: number;
  selectionMode: "fixed" | "random_from_bank";
  resolutionMode: "per_attempt" | "per_publish";
  poolFilter: { count?: number } | null;
  itemCount: number;
}

interface Props {
  examId: string;
  editable: boolean;
  passages: PassageData[];
  questions: QuestionData[];
}

const NEW_SECTION_HINT =
  'Nếu muốn đề thi của bạn có các phần khác nhau chạy lần lượt như Phần 1 - Trắc nghiệm, Phần 2 - Tự luận hoặc Phần 1 - Listening, Phần 2 - Reading... thì hãy thêm section mới tại đây.';

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
  | { kind: "newQuestion"; passageId: string | null; sectionId?: string | null }
  | { kind: "fromBank"; sectionId?: string | null }
  | { kind: "editQuestion"; questionId: string };

export default function ContentManager({ examId, editable, passages, questions }: Props) {
  const router = useRouter();
  const [edit, setEdit] = useState<EditState>({ kind: "idle" });
  const [working, setWorking] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  // "Phần" (ExamSection) — chỉ khi có ≥2 phần thì khu vực câu hỏi độc lập mới
  // chuyển sang hiển thị dạng khung theo từng phần. 0-1 phần: giao diện y hệt
  // trước đây, không ai thấy khái niệm "Phần" cả.
  const [sections, setSections] = useState<SectionSummary[] | null>(null);
  // Khung nào đang mở bộ chọn "Từ ngân hàng / Tự soạn" — key là sectionId
  // thật, hoặc "implicit" cho khung Phần 1 ngầm định (câu hỏi chưa gán phần).
  const [chooserFor, setChooserFor] = useState<string | null>(null);

  const refreshSections = () => {
    fetch(`/api/exams/${examId}/sections`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { sections: SectionSummary[] } | null) => setSections(j?.sections ?? []));
  };
  useEffect(() => {
    refreshSections();
    const onChange = () => refreshSections();
    window.addEventListener("fbm:exam-sections-changed", onChange);
    return () => window.removeEventListener("fbm:exam-sections-changed", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const boxed = (sections?.length ?? 0) >= 2;

  async function addSectionLightweight(showHint: boolean) {
    const nextPosition = (sections?.length ?? 0) + 2; // vị trí 1 là khung ngầm định
    const defaultTitle = `Phần ${nextPosition}`;
    // 1 dialog vừa xác nhận vừa hỏi tên — vd "Phần 2 - Tự luận" thay vì tên
    // đếm số vô nghĩa. Bỏ trống/Huỷ → không tạo gì cả.
    const promptMsg = showHint ? `${NEW_SECTION_HINT}\n\nTên phần mới:` : "Tên phần mới:";
    const title = window.prompt(promptMsg, defaultTitle);
    if (title === null) return;
    const r = await fetch(`/api/exams/${examId}/sections`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title.trim() || defaultTitle, selectionMode: "fixed" }),
    });
    if (!r.ok) {
      alert("Tạo phần thất bại");
      return;
    }
    window.dispatchEvent(new Event("fbm:exam-sections-changed"));
    refreshSections();
  }
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

  function renderQuestionRow(
    q: QuestionData,
    list: QuestionData[],
    i: number,
    passageId: string | null,
    reorderable = true,
  ) {
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
    const dp = reorderable
      ? dragProps(`q:${passageId ?? "standalone"}`, i, (from, to) =>
          reorderByDrop(
            list,
            from,
            to,
            `/api/exams/${examId}/questions/reorder`,
            "orderedQuestionIds",
            { passageId },
          ),
        )
      : ({} as ReturnType<typeof dragProps>);
    return (
      <div
        {...dp}
        className={`flex items-start gap-2 rounded border border-default bg-white px-3 py-2 text-sm ${dp.className ?? ""}`}
      >
        {editable && reorderable && (
          <span className="cursor-grab text-faint" title="Kéo để sắp xếp">
            ⋮⋮
          </span>
        )}
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
          {TYPE_LABEL[q.type] ?? q.type}
        </span>
        {q.bankCode && (
          <span
            className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-700"
            title="Mã câu hỏi gốc từ ngân hàng"
          >
            {q.bankCode}
          </span>
        )}
        <span className="flex-1 whitespace-pre-wrap break-words">{q.prompt || <em className="text-faint">(chưa có đề)</em>}</span>
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
            {reorderable && (
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
              </>
            )}
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

  const showPassages = passages.length > 0 || edit.kind === "newPassage";

  return (
    <div className="space-y-6">
      <ImportQuestionsModal
        examId={examId}
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />

      {editable && edit.kind === "fromBank" && (
        <BankPickerModal
          examId={examId}
          sectionId={edit.sectionId ?? null}
          onClose={() => setEdit({ kind: "idle" })}
        />
      )}

      {/* CTA chính (chỉ khi chưa chia phần — đã chia thì mỗi khung có CTA riêng) + menu phụ */}
      {editable && (
        <div className="-mt-3 mb-1 flex flex-wrap items-center justify-between gap-2">
          {!boxed && edit.kind === "idle" && !addMenuOpen && (
            <button
              type="button"
              onClick={() => setAddMenuOpen(true)}
              className="inline-flex items-center gap-1.5 rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" /> Thêm câu hỏi
            </button>
          )}
          {!boxed && addMenuOpen && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-faint">Lấy câu hỏi từ đâu?</span>
              <button
                type="button"
                onClick={() => {
                  setAddMenuOpen(false);
                  setEdit({ kind: "fromBank", sectionId: null });
                }}
                className="inline-flex items-center gap-1.5 rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-100"
              >
                <BookOpen className="h-4 w-4" /> Từ ngân hàng
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddMenuOpen(false);
                  setEdit({ kind: "newQuestion", passageId: null, sectionId: null });
                }}
                className="inline-flex items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              >
                <PenLine className="h-4 w-4" /> Tự soạn
              </button>
              <button
                type="button"
                onClick={() => setAddMenuOpen(false)}
                className="text-sm text-faint hover:underline"
              >
                Huỷ
              </button>
            </div>
          )}
          {edit.kind === "idle" && !addMenuOpen && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreMenuOpen((v) => !v)}
                aria-label="Thêm tuỳ chọn khác"
                className="rounded border border-default p-1.5 text-slate-500 hover:bg-slate-50"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {moreMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMoreMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-48 rounded border border-default bg-white py-1 text-sm shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        setImportOpen(true);
                      }}
                      className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                    >
                      Import từ Excel
                    </button>
                    {!showPassages && (
                      <button
                        type="button"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          setEdit({ kind: "newPassage" });
                        }}
                        className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      >
                        Thêm đoạn bài đọc (đọc hiểu)
                      </button>
                    )}
                    {!boxed && (
                      <button
                        type="button"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          void addSectionLightweight(true);
                        }}
                        className="block w-full px-3 py-1.5 text-left hover:bg-slate-50"
                      >
                        + Section mới
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Passages — chỉ hiện khi đã có đoạn, hoặc giáo viên chủ động thêm từ menu phụ */}
      {showPassages && (
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-faint">
            Đoạn bài đọc ({passages.length})
          </h3>
          {editable && edit.kind === "idle" && (
            <button
              type="button"
              onClick={() => setEdit({ kind: "newPassage" })}
              className="rounded bg-brand-600 px-3 py-1 text-xs font-medium text-white"
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
                    {/* Nội dung đoạn đọc (Tiptap) — hiện cả ở chế độ xem. */}
                    {(() => {
                      const doc = p.contentJson as TiptapDoc | null;
                      if (!doc || !(doc.content?.length)) return null;
                      return (
                        <div className="prose prose-sm mb-2 max-w-none rounded border border-default bg-white px-3 py-2">
                          {renderDoc(doc)}
                        </div>
                      );
                    })()}
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
      )}

      {/* Standalone questions — chưa chia phần: y hệt trước đây, 1 danh sách phẳng. */}
      {!boxed && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-faint">
              Câu hỏi độc lập ({standalone.length})
            </h3>
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
      )}

      {/* Đã chia ≥2 phần — mỗi phần 1 khung riêng, có CTA "+ Thêm câu hỏi" của chính nó. */}
      {boxed && (
        <section>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-faint">
            Câu hỏi độc lập
          </h3>
          <div className="space-y-3">
            {(() => {
              const sortedSections = [...(sections ?? [])].sort(
                (a, b) => a.orderIndex - b.orderIndex,
              );
              const boxes: Array<{
                key: string;
                label: string;
                section: SectionSummary | null;
                list: QuestionData[];
              }> = [
                {
                  key: "implicit",
                  label: "Phần 1",
                  section: null,
                  list: standalone.filter((q) => !q.sectionId),
                },
                // Phần thật hiển thị đúng tên giáo viên đặt (vd "Phần 2 - Tự
                // luận") — không ghép thêm số thứ tự để khỏi lặp "Phần 2 —
                // Phần 2 - Tự luận".
                ...sortedSections.map((s) => ({
                  key: s.id,
                  label: s.title,
                  section: s,
                  list: standalone.filter((q) => q.sectionId === s.id),
                })),
              ];
              return boxes.map((box) => (
                <div key={box.key} className="rounded border border-dashed border-default/70 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-600">{box.label}</span>
                    <span className="text-xs text-faint">{box.list.length} câu</span>
                  </div>

                  {box.section?.selectionMode === "random_from_bank" ? (
                    <p className="text-xs text-faint">
                      Rút ngẫu nhiên từ ngân hàng — xem/chỉnh trong &ldquo;Chia đề thành nhiều
                      phần&rdquo; bên dưới.
                    </p>
                  ) : (
                    <>
                      {editable &&
                        edit.kind === "newQuestion" &&
                        edit.passageId === null &&
                        edit.sectionId === (box.section?.id ?? null) && (
                          <div className="mb-2">
                            <QuestionEditor
                              mode="create"
                              examId={examId}
                              passageId={null}
                              sectionId={box.section?.id ?? null}
                              onClose={() => setEdit({ kind: "idle" })}
                            />
                          </div>
                        )}

                      {box.list.length === 0 && edit.kind === "idle" && (
                        <p className="rounded border border-dashed border-default px-3 py-3 text-center text-xs text-faint">
                          Chưa có câu hỏi.
                        </p>
                      )}

                      <ul className="space-y-1.5">
                        {box.list.map((q, i) => (
                          <li key={q.id}>{renderQuestionRow(q, box.list, i, null, false)}</li>
                        ))}
                      </ul>

                      {editable && edit.kind === "idle" && chooserFor !== box.key && (
                        <button
                          type="button"
                          onClick={() => setChooserFor(box.key)}
                          className="mt-2 inline-flex items-center gap-1.5 rounded border border-dashed border-emerald-400 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                        >
                          <Plus className="h-3.5 w-3.5" /> Thêm câu hỏi
                        </button>
                      )}
                      {editable && chooserFor === box.key && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-faint">Lấy câu hỏi từ đâu?</span>
                          <button
                            type="button"
                            onClick={() => {
                              setChooserFor(null);
                              setEdit({ kind: "fromBank", sectionId: box.section?.id ?? null });
                            }}
                            className="inline-flex items-center gap-1.5 rounded border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                          >
                            <BookOpen className="h-3.5 w-3.5" /> Từ ngân hàng
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setChooserFor(null);
                              setEdit({
                                kind: "newQuestion",
                                passageId: null,
                                sectionId: box.section?.id ?? null,
                              });
                            }}
                            className="inline-flex items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
                          >
                            <PenLine className="h-3.5 w-3.5" /> Tự soạn
                          </button>
                          <button
                            type="button"
                            onClick={() => setChooserFor(null)}
                            className="text-xs text-faint hover:underline"
                          >
                            Huỷ
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ));
            })()}
          </div>

          {editable && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void addSectionLightweight(false)}
                className="inline-flex items-center gap-1.5 rounded border border-dashed border-default px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" /> Section mới
              </button>
              <p className="mt-1 max-w-xl text-xs text-faint">{NEW_SECTION_HINT}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
