"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml, htmlToPlainText } from "@/lib/richText";
import type { AnswerState, Option, Question, Response } from "./questionInputTypes";

/**
 * Ô nhập cho câu Sắp xếp, Ghép cặp, Kéo thả điền — chuyển NGUYÊN VĂN từ QuizPlayer để Quiz và đề thi dùng chung (đề thi nối qua
 * ExamQuestion). Dùng @dnd-kit; điện thoại có phương án chạm (↑↓, chọn trong danh sách).
 */

export function OrderingInput({
  question,
  answer,
  onChange,
  onBlur,
}: {
  question: Question;
  answer: AnswerState | undefined;
  onChange: (r: Response) => void;
  onBlur: () => void;
}) {
  // Build the working list of option IDs:
  //   1) Start from saved response if it's a string[] (resume case).
  //   2) Filter out IDs no longer in question.options (option deleted server-side).
  //   3) APPEND any new question.options not present in the saved response —
  //      previously the player just discarded the saved response and reset to
  //      canonical order if ANY id was missing, but the more common case is
  //      "instructor added option N+1 after attempt started" → saved response
  //      had N ids, new option Nth+1 silently disappeared from UI.
  const validIds = new Set(question.options.map((o) => o.id));
  const saved = Array.isArray(answer?.response)
    ? (answer!.response as string[]).filter((id) => validIds.has(id))
    : [];
  const missing = question.options
    .map((o) => o.id)
    .filter((id) => !saved.includes(id));
  const ids = saved.length > 0 ? [...saved, ...missing] : question.options.map((o) => o.id);
  const optById = new Map(question.options.map((o) => [o.id, o]));

  function move(idx: number, delta: number) {
    const next = [...ids];
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= next.length) return;
    [next[idx], next[newIdx]] = [next[newIdx]!, next[idx]!];
    onChange(next);
    setTimeout(onBlur, 0);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onChange(arrayMove(ids, oldIdx, newIdx));
    setTimeout(onBlur, 0);
  }

  return (
    <>
      {/* Mobile: button ↑↓ (tap-select fallback) */}
      <ol className="space-y-2 md:hidden">
        {ids.map((id, i) => (
          <li
            key={id}
            className="flex items-center gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-3"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-700 tabular-nums">
              {i + 1}
            </span>
            <SafeHtml
              html={plainToRichHtml(optById.get(id)?.label ?? "")}
              className="prose prose-sm max-w-none flex-1 text-sm dark:prose-invert"
            />
            <div className="flex gap-1">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-token bg-[rgb(var(--surface))] text-xs transition-colors hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={i === ids.length - 1}
                onClick={() => move(i, +1)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-token bg-[rgb(var(--surface))] text-xs transition-colors hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30"
                aria-label="Move down"
              >
                ↓
              </button>
            </div>
          </li>
        ))}
      </ol>

      {/* Desktop: horizontal drag-and-drop */}
      <div className="hidden md:block">
        <p className="mb-2 text-xs text-faint">Kéo thả các thẻ theo thứ tự đúng (trái → phải)</p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
            <ol className="flex flex-wrap items-stretch gap-2">
              {ids.map((id, i) => (
                <SortableOrderingItem
                  key={id}
                  id={id}
                  index={i}
                  label={optById.get(id)?.label ?? ""}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </div>
    </>
  );
}

function SortableOrderingItem({
  id,
  index,
  label,
}: {
  id: string;
  index: number;
  label: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex min-w-[120px] cursor-grab touch-none items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-3 shadow-sm transition-shadow hover:shadow active:cursor-grabbing"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-700 tabular-nums">
        {index + 1}
      </span>
      <SafeHtml
        html={plainToRichHtml(label)}
        className="prose prose-sm max-w-none text-sm dark:prose-invert"
      />
    </li>
  );
}

export function MatchingInput({
  question,
  answer,
  onChange,
  onBlur,
  layout = "side",
}: {
  question: Question;
  answer: AnswerState | undefined;
  onChange: (r: Response) => void;
  onBlur: () => void;
  /**
   * "side": hai cột cạnh nhau (kho thẻ bên phải) — hợp trang rộng như Quiz. "stacked": kho thẻ nằm trên, các ô ghép xếp thành một cột
   * bên dưới, mỗi ô dùng hết bề ngang — hợp cột hẹp cạnh đoạn văn của đề thi/luyện đề (hai cột trong cột hẹp làm thẻ tràn ra khỏi ô).
   */
  layout?: "side" | "stacked";
}) {
  const lefts = question.options.filter((o) => o.extra?.side === "left");
  const rights = question.options.filter((o) => o.extra?.side === "right");
  const rightById = new Map(rights.map((r) => [r.id, r]));

  const pairs = Array.isArray(answer?.response)
    ? (answer!.response as Array<{ leftId: string; rightId: string }>)
    : [];
  const byLeft = new Map(pairs.map((p) => [p.leftId, p.rightId]));
  const usedRights = new Set(byLeft.values());
  const poolRights = rights.filter((r) => !usedRights.has(r.id));

  function commit(next: Map<string, string>) {
    const out: Array<{ leftId: string; rightId: string }> = [];
    for (const left of lefts) {
      const r = next.get(left.id);
      if (r) out.push({ leftId: left.id, rightId: r });
    }
    onChange(out);
    setTimeout(onBlur, 0);
  }

  function pick(leftId: string, rightId: string) {
    const next = new Map(byLeft);
    // If rightId already on another left, remove that mapping first.
    for (const [l, r] of next) {
      if (r === rightId && l !== leftId) next.delete(l);
    }
    next.set(leftId, rightId);
    commit(next);
  }

  function clear(leftId: string) {
    const next = new Map(byLeft);
    next.delete(leftId);
    commit(next);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const rightId = String(active.id).replace(/^right:/, "");
    const overId = String(over.id);
    if (overId === "matching:pool") {
      // Drop back to pool → unassign from whatever left it was on.
      for (const [l, r] of byLeft) {
        if (r === rightId) {
          clear(l);
          return;
        }
      }
      return;
    }
    if (overId.startsWith("left:")) {
      const leftId = overId.slice("left:".length);
      pick(leftId, rightId);
    }
  }

  return (
    <>
      {/* Mobile: dropdown fallback */}
      <ul className="space-y-2 md:hidden">
        {lefts.map((l) => (
          <li
            key={l.id}
            className="space-y-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-3"
          >
            {/* Xếp chồng: ô chọn đứng cạnh chữ thì phương án dài làm cột chữ co lại còn từng ký tự một dòng. */}
            <SafeHtml
              html={plainToRichHtml(l.label)}
              className="prose prose-sm max-w-none text-sm font-medium dark:prose-invert"
            />
            <select
              value={byLeft.get(l.id) ?? ""}
              onChange={(e) => pick(l.id, e.target.value)}
              aria-label={htmlToPlainText(l.label)}
              className="select min-h-[44px] w-full"
            >
              <option value="">— chọn —</option>
              {rights.map((r) => (
                <option key={r.id} value={r.id}>
                  {htmlToPlainText(r.label)}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>

      {/* Desktop: drag from right pool to left slots */}
      <div className="hidden md:block">
        <p className="mb-2 text-xs text-faint">
          {layout === "stacked" ? "Kéo các thẻ từ kho bên dưới thả vào ô trống tương ứng" : "Kéo các thẻ bên phải thả vào ô trống tương ứng bên trái"}
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {(() => {
            const slots = (
              <ul className="space-y-2">
                {lefts.map((l) => (
                  <MatchingLeftSlot
                    key={l.id}
                    leftId={l.id}
                    leftLabel={l.label}
                    assignedRight={
                      byLeft.has(l.id)
                        ? { id: byLeft.get(l.id)!, label: rightById.get(byLeft.get(l.id)!)?.label ?? "" }
                        : null
                    }
                    onClear={() => clear(l.id)}
                    compact={layout === "stacked"}
                  />
                ))}
              </ul>
            );
            return layout === "stacked" ? (
              <div className="space-y-3">
                <MatchingPool poolRights={poolRights} />
                {slots}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {slots}
                <MatchingPool poolRights={poolRights} />
              </div>
            );
          })()}
        </DndContext>
      </div>
    </>
  );
}

function MatchingLeftSlot({
  leftId,
  leftLabel,
  assignedRight,
  onClear,
  compact = false,
}: {
  leftId: string;
  leftLabel: string;
  assignedRight: { id: string; label: string } | null;
  onClear: () => void;
  /** Cột hẹp: nhãn bên trái chỉ chiếm vừa chữ (tối đa 40%), ô thả dùng hết phần còn lại. */
  compact?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `left:${leftId}` });
  return (
    <li className="flex items-center gap-2">
      <SafeHtml
        html={plainToRichHtml(leftLabel)}
        className={`prose prose-sm max-w-none text-sm font-medium dark:prose-invert ${
          compact ? "max-w-[40%] shrink-0" : "min-w-[6rem] flex-1"
        }`}
      />
      <span className="text-faint">→</span>
      <div
        ref={setNodeRef}
        className={`flex min-h-[44px] min-w-0 items-center justify-between gap-2 rounded-xl border-2 border-dashed p-2 transition-colors ${
          compact ? "flex-1" : "flex-[2]"
        } ${
          isOver
            ? "border-brand-500 bg-brand-soft"
            : assignedRight
              ? "border-brand-300 bg-[rgb(var(--surface))]"
              : "border-token bg-[rgb(var(--surface-muted))]"
        }`}
      >
        {assignedRight ? (
          <>
            <MatchingDraggable id={assignedRight.id} label={assignedRight.label} compact />
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 px-1 text-xs text-faint hover:text-brand-700"
              aria-label="Bỏ chọn"
            >
              ✕
            </button>
          </>
        ) : (
          <span className="text-xs text-faint">— thả vào đây —</span>
        )}
      </div>
    </li>
  );
}

function MatchingPool({
  poolRights,
}: {
  poolRights: Array<{ id: string; label: string }>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "matching:pool" });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-wrap content-start gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${
        isOver ? "border-brand-500 bg-brand-soft" : "border-token bg-[rgb(var(--surface-muted))]"
      }`}
    >
      {poolRights.length === 0 ? (
        <span className="text-xs text-faint">Đã ghép hết — kéo thẻ về đây để bỏ chọn</span>
      ) : (
        poolRights.map((r) => <MatchingDraggable key={r.id} id={r.id} label={r.label} />)
      )}
    </div>
  );
}

function MatchingDraggable({
  id,
  label,
  compact = false,
}: {
  id: string;
  label: string;
  compact?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `right:${id}`,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <span
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`inline-flex min-w-0 max-w-full cursor-grab touch-none items-center break-words rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-1.5 text-sm shadow-sm transition-shadow hover:shadow active:cursor-grabbing ${
        compact ? "" : ""
      }`}
    >
      <SafeHtml
        html={plainToRichHtml(label)}
        className="prose prose-sm max-w-none text-sm dark:prose-invert"
      />
    </span>
  );
}

// ─── DRAG-DROP FILL ─────────────────────────────────────────────────────────
//
// Renders the prompt with [[N]] placeholders replaced by drop zones. A pool of
// draggable tokens (correct + distractors) sits below. Learner drags each
// token into a blank; only one token per blank. Response shape:
//   { tokens: { [blankIndex: number]: optionId } }
//
// Backed by @dnd-kit (already used for matching). Mobile fallback: tap a
// blank, then tap a token to assign (same pattern as MatchingInput mobile).

export function DragDropFillInput({
  question,
  answer,
  onChange,
  onBlur,
}: {
  question: Question;
  answer: AnswerState | undefined;
  onChange: (r: Response) => void;
  onBlur: () => void;
}) {
  // Parse prompt into segments split by [[N]] placeholders. Each placeholder
  // becomes a drop-zone slot with blankIndex = N. Plain text segments stay
  // text. Backend strips HTML for grading, so we treat prompt as plain text
  // (the instructor enters it via plain RichTextEditor but we render as text
  // here so the drop zones can be inline-flow-aware).
  const segments = parsePromptBlanks(question.prompt);
  // Distinct blanks discovered in the prompt — what UI actually offers.
  const blanksInPrompt = Array.from(
    new Set(
      segments
        .filter((s): s is { kind: "blank"; index: number } => s.kind === "blank")
        .map((s) => s.index),
    ),
  ).sort((a, b) => a - b);

  // Current placements: blankIndex (as string key) → optionId. Pulled from
  // saved answer if any.
  const raw = answer?.response as { tokens?: Record<string, string> } | unknown;
  const placed: Record<string, string> =
    typeof raw === "object" && raw !== null && "tokens" in raw
      ? { ...(raw as { tokens: Record<string, string> }).tokens }
      : {};

  const tokens = question.options;
  const placedOptionIds = new Set(Object.values(placed));
  const poolTokens = tokens.filter((t) => !placedOptionIds.has(t.id));

  function commit(next: Record<string, string>) {
    onChange({ tokens: next });
    setTimeout(onBlur, 0);
  }
  function place(blankIdx: number, optionId: string) {
    const next = { ...placed };
    // If this option is already placed in another blank, remove it there.
    for (const [k, v] of Object.entries(next)) {
      if (v === optionId && Number(k) !== blankIdx) delete next[k];
    }
    next[String(blankIdx)] = optionId;
    commit(next);
  }
  function clear(blankIdx: number) {
    const next = { ...placed };
    delete next[String(blankIdx)];
    commit(next);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const optionId = String(active.id).replace(/^token:/, "");
    const overId = String(over.id);
    if (overId === "ddf:pool") {
      // Drop back to pool → unassign wherever this option was.
      for (const [k, v] of Object.entries(placed)) {
        if (v === optionId) {
          clear(Number(k));
          return;
        }
      }
      return;
    }
    if (overId.startsWith("blank:")) {
      const idx = Number(overId.slice("blank:".length));
      if (Number.isFinite(idx)) place(idx, optionId);
    }
  }

  // No blanks parsed (instructor forgot [[N]] markers) — degrade to plain
  // prompt + token list with manual click-to-place so question still works.
  if (blanksInPrompt.length === 0) {
    return (
      <div className="rounded-lg border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800">
        Câu hỏi này thiếu ký hiệu ô <code>[[1]]</code>… trong nội dung. Liên hệ
        giảng viên.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-4">
        <div className="flex flex-wrap items-center gap-2 leading-loose text-base">
          {segments.map((seg, i) => {
            if (seg.kind === "text") {
              return (
                <span key={i} className="whitespace-pre-wrap">
                  {seg.text}
                </span>
              );
            }
            const placedId = placed[String(seg.index)];
            const placedOpt = placedId
              ? tokens.find((t) => t.id === placedId)
              : null;
            return (
              <DragDropBlank
                key={i}
                blankIndex={seg.index}
                placed={placedOpt ?? null}
                onClear={() => clear(seg.index)}
              />
            );
          })}
        </div>
      </div>

      <p className="mt-3 text-xs text-faint">Kéo các từ bên dưới thả vào ô tương ứng:</p>
      <DragDropTokenPool tokens={poolTokens} />
    </DndContext>
  );
}

function parsePromptBlanks(
  prompt: string,
): Array<{ kind: "text"; text: string } | { kind: "blank"; index: number }> {
  const out: Array<{ kind: "text"; text: string } | { kind: "blank"; index: number }> = [];
  const re = /\[\[(\d+)\]\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    if (m.index > last) out.push({ kind: "text", text: prompt.slice(last, m.index) });
    out.push({ kind: "blank", index: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < prompt.length) out.push({ kind: "text", text: prompt.slice(last) });
  return out;
}

function DragDropBlank({
  blankIndex,
  placed,
  onClear,
}: {
  blankIndex: number;
  placed: Option | null;
  onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `blank:${blankIndex}` });
  return (
    <span
      ref={setNodeRef}
      className={`inline-flex min-h-[34px] min-w-[110px] items-center justify-between gap-2 rounded-md border-2 border-dashed px-2 py-0.5 align-middle text-sm transition-colors ${
        isOver
          ? "border-brand-500 bg-brand-soft"
          : placed
            ? "border-brand-300 bg-[rgb(var(--surface))]"
            : "border-token bg-[rgb(var(--surface-muted))]"
      }`}
    >
      {placed ? (
        <>
          <DragDropToken option={placed} compact />
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-faint hover:text-danger-600"
            aria-label="Bỏ chọn token này"
            title="Bỏ"
          >
            ×
          </button>
        </>
      ) : (
        <span className="text-xs text-faint">Ô {blankIndex}</span>
      )}
    </span>
  );
}

function DragDropTokenPool({ tokens }: { tokens: Option[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: "ddf:pool" });
  return (
    <div
      ref={setNodeRef}
      className={`mt-2 flex flex-wrap gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${
        isOver
          ? "border-brand-500 bg-brand-soft"
          : "border-token bg-[rgb(var(--surface-muted))]"
      }`}
    >
      {tokens.length === 0 ? (
        <span className="text-xs text-faint">Đã đặt hết token. Kéo lại vào đây để bỏ.</span>
      ) : (
        tokens.map((t) => <DragDropToken key={t.id} option={t} />)
      )}
    </div>
  );
}

function DragDropToken({ option, compact = false }: { option: Option; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `token:${option.id}`,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <span
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`inline-flex cursor-grab touch-none items-center rounded-lg border border-token bg-[rgb(var(--surface))] ${
        compact ? "px-2 py-0.5" : "px-3 py-1.5"
      } text-sm shadow-sm transition-shadow hover:shadow active:cursor-grabbing`}
    >
      <SafeHtml
        html={plainToRichHtml(option.label)}
        className="prose prose-sm max-w-none text-sm dark:prose-invert"
      />
    </span>
  );
}
