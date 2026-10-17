"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ChevronDown, GripVertical, Plus, Scissors, Trash2, X } from "lucide-react";
import {
  LESSON_BOX_LABELS,
  LESSON_LAYOUT_HINTS,
  LESSON_LAYOUT_KEYS,
  LESSON_LAYOUT_LABELS,
  OUTLINE_BOX_KINDS,
  OUTLINE_LIMITS,
  type LessonLayoutKey,
  type LessonOutline,
  type OutlineSection,
  type SourcePara,
} from "@feedbackme/shared-types";
import { lessonReadingMinutes, shouldSuggestSplit } from "@/lib/lessonOutline";
import {
  addSection,
  mergeLessonUp,
  moveSection,
  paraRangeLabel,
  removeSection,
  splitLessonAt,
  updateLesson,
  updateSection,
} from "@/lib/lessonOutlineEdit";
import LayoutIcon from "./LayoutIcon";

/**
 * Cột trái của màn Dàn ý: tên bài, mục tiêu, các mục. Sửa tại chỗ, không có
 * hộp thoại; một mục mở rộng một lúc để xem ý chính và hộp. Sửa ở đây không gọi
 * AI và không tốn token (D6).
 */
export default function OutlinePane({
  outline,
  paras,
  orphans,
  activeId,
  onChange,
  onActivate,
  onShowSource,
}: {
  outline: LessonOutline;
  paras: SourcePara[];
  orphans: number[];
  activeId: string | null;
  onChange: (o: LessonOutline) => void;
  onActivate: (id: string | null) => void;
  onShowSource: (sectionId: string | null) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const allIds = outline.lessons.flatMap((l) => l.sections.map((s) => s.id));
  const totalSections = allIds.length;
  const multi = outline.lessons.length > 1;
  let n = 0;

  function onDragEnd(e: DragEndEvent) {
    if (e.over && e.active.id !== e.over.id) onChange(moveSection(outline, String(e.active.id), String(e.over.id)));
  }

  return (
    <div className="space-y-4">
      {orphans.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/25 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{orphans.length} đoạn của tài liệu chưa thuộc mục nào</span>
          <button type="button" className="font-semibold underline" onClick={() => onShowSource(null)}>
            Xem
          </button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
          {outline.lessons.map((lesson, li) => (
            <div key={lesson.id} className="space-y-2">
              {multi ? (
                <div className="flex items-center gap-2 pt-2">
                  <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-faint">Bài {li + 1}</span>
                  {/* Tên và mục tiêu của bài 1 sửa ở đầu trang. */}
                  {li === 0 ? (
                    <span className="min-w-0 flex-1 truncate px-1.5 font-semibold">{lesson.title}</span>
                  ) : (
                  <input
                    value={lesson.title}
                    onChange={(e) => onChange(updateLesson(outline, li, { title: e.target.value }))}
                    placeholder="Tên bài"
                    maxLength={OUTLINE_LIMITS.titleMax}
                    aria-label={`Tên bài ${li + 1}`}
                    className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 font-semibold hover:border-token focus:border-brand-300 focus:outline-none"
                  />
                  )}
                  <span className="shrink-0 text-xs text-faint">
                    {lesson.sections.length} mục · {lessonReadingMinutes(lesson, paras)} phút
                  </span>
                  {li > 0 && (
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-brand-700 hover:underline"
                      onClick={() => onChange(mergeLessonUp(outline, li))}
                    >
                      Gộp vào bài trên
                    </button>
                  )}
                </div>
              ) : null}

              {multi && li > 0 && (
                <Objectives
                  objectives={lesson.objectives}
                  onChange={(objectives) => onChange(updateLesson(outline, li, { objectives }))}
                  compact
                />
              )}

              {shouldSuggestSplit(lesson, paras) && (
                <p className="text-caption rounded-md bg-[rgb(var(--surface-muted))] px-2.5 py-1.5 text-muted">
                  Bài này khá dài ({lesson.sections.length} mục, khoảng {lessonReadingMinutes(lesson, paras)} phút đọc). Có thể
                  tách thành hai bài bằng nút <Scissors className="inline h-3 w-3" aria-hidden /> giữa hai mục.
                </p>
              )}

              <ol className="space-y-1.5">
                {lesson.sections.map((s, si) => {
                  n += 1;
                  return (
                    <li key={s.id}>
                      {si > 0 && (
                        <SplitGap onSplit={() => onChange(splitLessonAt(outline, li, si))} />
                      )}
                      <SectionRow
                        num={n}
                        s={s}
                        open={activeId === s.id}
                        canDelete={totalSections > 1}
                        onToggle={() => onActivate(activeId === s.id ? null : s.id)}
                        onFocus={() => activeId !== s.id && onActivate(s.id)}
                        onPatch={(patch) => onChange(updateSection(outline, s.id, patch))}
                        onDelete={() => {
                          onChange(removeSection(outline, s.id));
                          onActivate(null);
                        }}
                        onShowSource={() => onShowSource(s.id)}
                      />
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() => {
          const r = addSection(outline, outline.lessons.length - 1);
          onChange(r.outline);
          onActivate(r.id);
          setTimeout(() => {
            const el = document.querySelector<HTMLTextAreaElement>(`[data-title-input="${r.id}"]`);
            el?.focus();
            el?.select();
          }, 0);
        }}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-token py-2.5 text-sm font-medium text-muted transition-colors hover:border-brand-400 hover:bg-brand-soft hover:text-brand-700"
      >
        <Plus className="h-4 w-4" aria-hidden /> Thêm mục
      </button>
    </div>
  );
}

/** Mục tiêu học tập: mỗi dòng sửa tại chỗ, xoá, thêm (tối đa 5). */
export function Objectives({
  objectives,
  onChange,
  compact = false,
}: {
  objectives: string[];
  onChange: (o: string[]) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "pl-1" : ""}>
      {!compact && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wide text-faint">Mục tiêu học tập</span>
          {objectives.length < OUTLINE_LIMITS.maxObjectives && (
            <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => onChange([...objectives, ""])}>
              + Thêm
            </button>
          )}
        </div>
      )}
      <ul className="space-y-0.5">
        {objectives.map((o, i) => (
          <li key={i} className="group flex items-start gap-2 rounded-md px-1 hover:bg-[rgb(var(--surface-muted))]">
            <span className="mt-[0.6rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
            <AutoText
              value={o}
              placeholder="Ví dụ: Phân biệt được…"
              ariaLabel={`Mục tiêu ${i + 1}`}
              onChange={(v) => onChange(objectives.map((x, j) => (j === i ? v : x)))}
              className={compact ? "text-xs" : "text-sm"}
            />
            <button
              type="button"
              aria-label={`Xoá mục tiêu ${i + 1}`}
              onClick={() => onChange(objectives.filter((_, j) => j !== i))}
              className="mt-1 rounded p-0.5 text-faint opacity-0 hover:text-danger-600 focus:opacity-100 group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
      {compact && objectives.length < OUTLINE_LIMITS.maxObjectives && (
        <button type="button" className="ml-4 text-xs font-medium text-brand-700 hover:underline" onClick={() => onChange([...objectives, ""])}>
          + Mục tiêu
        </button>
      )}
    </div>
  );
}

/** Ô chữ không viền, tự giãn chiều cao theo nội dung — trông như chữ thường, bấm là sửa. */
function AutoText({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = "",
  onFocus,
  inputProps,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  onFocus?: () => void;
  inputProps?: Record<string, string>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={onFocus}
      onChange={(e) => onChange(e.target.value.replace(/\n/g, " "))}
      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), (e.target as HTMLTextAreaElement).blur())}
      maxLength={OUTLINE_LIMITS.pointMax}
      className={`min-w-0 flex-1 resize-none overflow-hidden rounded border border-transparent bg-transparent px-1 py-0.5 leading-snug focus:border-brand-300 focus:bg-[rgb(var(--surface))] focus:outline-none ${className}`}
      {...inputProps}
    />
  );
}

function SplitGap({ onSplit }: { onSplit: () => void }) {
  return (
    <div className="group relative h-1.5">
      <button
        type="button"
        onClick={onSplit}
        className="absolute left-1/2 top-1/2 z-[1] inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface))] px-2 py-0.5 text-[11px] text-muted opacity-0 shadow-sm transition-opacity hover:text-brand-700 focus:opacity-100 group-hover:opacity-100"
      >
        <Scissors className="h-3 w-3" aria-hidden /> Tách thành bài mới từ đây
      </button>
    </div>
  );
}

function SectionRow({
  num,
  s,
  open,
  canDelete,
  onToggle,
  onFocus,
  onPatch,
  onDelete,
  onShowSource,
}: {
  num: number;
  s: OutlineSection;
  open: boolean;
  canDelete: boolean;
  onToggle: () => void;
  onFocus: () => void;
  onPatch: (p: Partial<Omit<OutlineSection, "id">>) => void;
  onDelete: () => void;
  onShowSource: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const [layoutAnchor, setLayoutAnchor] = useState<DOMRect | null>(null);
  const layoutOpen = layoutAnchor !== null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border bg-[rgb(var(--surface))] transition-shadow ${
        open ? "border-brand-300 ring-2 ring-brand-100" : "border-token hover:border-brand-200"
      } ${isDragging ? "relative z-10 opacity-80 shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-1.5 py-1.5 pl-1 pr-1.5">
        <button
          type="button"
          className="grid h-8 w-6 shrink-0 cursor-grab place-items-center rounded text-faint hover:bg-[rgb(var(--surface-muted))] active:cursor-grabbing"
          aria-label={`Kéo để đổi thứ tự mục ${num}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="w-5 shrink-0 text-center text-xs font-bold tabular-nums text-faint">{num}</span>
        <AutoText
          value={s.title}
          onChange={(v) => onPatch({ title: v })}
          onFocus={onFocus}
          placeholder="Tiêu đề mục"
          ariaLabel={`Tiêu đề mục ${num}`}
          inputProps={{ "data-title-input": s.id }}
          className={`py-1 text-sm font-semibold hover:bg-[rgb(var(--surface-muted))] ${s.title.trim() ? "" : "border-amber-300"}`}
        />
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => setLayoutAnchor(layoutOpen ? null : e.currentTarget.getBoundingClientRect())}
            aria-haspopup="listbox"
            aria-expanded={layoutOpen}
            title={`Bố cục: ${LESSON_LAYOUT_LABELS[s.layout]}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-token px-1.5 py-1 text-xs text-muted hover:border-brand-300 hover:text-[rgb(var(--text))]"
          >
            <LayoutIcon layout={s.layout} className="h-4 w-6 text-brand-600" />
            <span className="hidden xl:inline">{LESSON_LAYOUT_LABELS[s.layout]}</span>
          </button>
          {layoutAnchor && (
            <LayoutMenu
              anchor={layoutAnchor}
              value={s.layout}
              onPick={(layout) => {
                onPatch({ layout });
                setLayoutAnchor(null);
              }}
              onClose={() => setLayoutAnchor(null)}
            />
          )}
        </div>
        <button
          type="button"
          onClick={onShowSource}
          className="hidden shrink-0 rounded px-1.5 py-1 text-xs text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))] sm:inline"
          title="Xem các đoạn tài liệu của mục này"
        >
          {paraRangeLabel(s.paras)}
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? "Thu gọn mục" : "Mở ý chính của mục"}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--text))]"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <div className="space-y-2 pb-3 pl-12 pr-3">
          <ul className="space-y-0.5">
            {s.points.map((p, i) => (
              <li key={i} className="group flex items-start gap-1.5 text-muted">
                <span className="mt-1 text-faint" aria-hidden>
                  –
                </span>
                <AutoText
                  value={p}
                  ariaLabel={`Ý chính ${i + 1}`}
                  placeholder="Ý chính của mục"
                  onChange={(v) => onPatch({ points: s.points.map((x, j) => (j === i ? v : x)) })}
                  className="text-sm"
                />
                <button
                  type="button"
                  aria-label={`Xoá ý ${i + 1}`}
                  onClick={() => onPatch({ points: s.points.filter((_, j) => j !== i) })}
                  className="mt-1 rounded p-0.5 text-faint opacity-0 hover:text-danger-600 focus:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          {s.points.length < OUTLINE_LIMITS.maxPoints && (
            <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => onPatch({ points: [...s.points, ""] })}>
              + Thêm ý
            </button>
          )}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-faint">Hộp trong mục:</span>
            {OUTLINE_BOX_KINDS.map((k) => {
              const on = s.boxes.includes(k);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPatch({ boxes: on ? s.boxes.filter((x) => x !== k) : [...s.boxes, k] })}
                  className={`rounded-lg border px-2 py-0.5 text-xs transition-colors ${
                    on ? "border-brand-300 bg-brand-soft text-brand-700" : "border-dashed border-token text-muted hover:border-solid"
                  }`}
                >
                  {on ? "" : "+ "}
                  {LESSON_BOX_LABELS[k]}
                </button>
              );
            })}
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-faint hover:text-danger-600"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Xoá mục
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const MENU_W = 288;
const MENU_H = 268;

function LayoutMenu({
  anchor,
  value,
  onPick,
  onClose,
}: {
  anchor: DOMRect;
  value: LessonLayoutKey;
  onPick: (l: LessonLayoutKey) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // Menu nổi theo vị trí nút: cột dàn ý tự cuộn nên menu đặt trong cột sẽ bị cắt.
    // Cuộn hoặc đổi cỡ cửa sổ thì đóng, khỏi lệch khỏi nút.
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", onClose);
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", onClose);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);
  const below = anchor.bottom + 6 + MENU_H <= window.innerHeight - 8;
  const top = below ? anchor.bottom + 6 : Math.max(8, anchor.top - 6 - MENU_H);
  const left = Math.max(8, Math.min(anchor.right - MENU_W, window.innerWidth - MENU_W - 8));
  return (
    <div
      ref={ref}
      role="listbox"
      aria-label="Bố cục của mục"
      style={{ position: "fixed", top, left, width: MENU_W }}
      className="z-50 grid grid-cols-2 gap-1.5 rounded-xl border border-token bg-[rgb(var(--surface))] p-2 shadow-xl"
    >
      {LESSON_LAYOUT_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          role="option"
          aria-selected={k === value}
          title={LESSON_LAYOUT_HINTS[k]}
          onClick={() => onPick(k)}
          className={`flex flex-col items-start gap-1 rounded-lg border p-2 text-left transition-colors ${
            k === value ? "border-brand-500 bg-brand-soft" : "border-token hover:border-brand-300"
          }`}
        >
          <LayoutIcon layout={k} className="h-5 w-8 text-brand-600" />
          <span className="text-xs font-semibold">{LESSON_LAYOUT_LABELS[k]}</span>
        </button>
      ))}
    </div>
  );
}
