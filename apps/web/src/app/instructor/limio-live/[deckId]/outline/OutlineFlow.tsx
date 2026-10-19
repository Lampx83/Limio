"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { PART_ROLE_LABEL, type Outline, type OutlineSlide } from "@/lib/limioLiveOutline";
import { SINGLE_SLIDE_ROLES, glyphKey, partRuns, rowSubtitle, type MoveTarget, type PartRun } from "@/lib/limioLiveOutlineUi";
import { cardPoints } from "@/lib/limioLiveOutlineCard";
import OutlineGlyph from "./OutlineGlyph";

interface Props {
  outline: Outline;
  onOpen: (slideId: string) => void;
  onRemove: (slideId: string) => void;
  onMove: (slideId: string, target: MoveTarget) => void;
  onAddSlide: (partId: string) => void;
  onRename: (partId: string, name: string) => void;
  /** Phần đang đổi tên (vừa thêm phần mới thì mở sẵn ô đổi tên). */
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
}

/**
 * Danh sách slide dọc, chia nhóm theo mạch cấu trúc của bài. Một đường dọc nối các phần, mỗi phần một chấm.
 * Kéo thả: thả lên slide thì vào chỗ slide đó và thuộc phần của nó; thả lên tên phần thì thành slide đầu;
 * thả lên dòng "Thêm slide vào phần này" thì thành slide cuối (moveSlide).
 */
export default function OutlineFlow({ outline, onOpen, onRemove, onMove, onAddSlide, onRename, renamingId, setRenamingId }: Props) {
  const [dragging, setDragging] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const runs = partRuns(outline);
  const canRemove = outline.slides.length > 1;

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(false);
    const id = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over || over === id) return;
    if (over.startsWith("start:")) onMove(id, { start: over.slice(6) });
    else if (over.startsWith("end:")) onMove(id, { end: over.slice(4) });
    else onMove(id, { over });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => setDragging(true)}
      onDragCancel={() => setDragging(false)}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={outline.slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <ol>
          {runs.map((r) => (
            <PartGroup
              key={r.part.id}
              run={r}
              slides={outline.slides.slice(r.from, r.to + 1)}
              dragging={dragging}
              canRemove={canRemove}
              renaming={renamingId === r.part.id}
              onStartRename={() => setRenamingId(r.part.id)}
              onEndRename={(name) => {
                setRenamingId(null);
                if (name !== null) onRename(r.part.id, name);
              }}
              onOpen={onOpen}
              onRemove={onRemove}
              onAdd={() => onAddSlide(r.part.id)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function PartGroup({
  run,
  slides,
  dragging,
  canRemove,
  renaming,
  onStartRename,
  onEndRename,
  onOpen,
  onRemove,
  onAdd,
}: {
  run: PartRun;
  slides: OutlineSlide[];
  dragging: boolean;
  canRemove: boolean;
  renaming: boolean;
  onStartRename: () => void;
  onEndRename: (name: string | null) => void;
  onOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}) {
  const { part, from, to, ordinal } = run;
  const head = useDroppable({ id: `start:${part.id}` });
  const tail = useDroppable({ id: `end:${part.id}` });
  const isContent = part.role === "content";
  const n = to - from + 1;
  const range = n === 1 ? `slide ${from + 1}` : `slide ${from + 1}–${to + 1} · ${n} slide`;

  return (
    <li className="group/part relative pl-7 before:absolute before:bottom-0 before:left-[10px] before:top-0 before:w-0.5 before:bg-[rgb(var(--border))] first:before:top-[22px] last:before:bottom-auto last:before:h-[22px] max-sm:pl-5 max-sm:before:left-[6px]">
      <div
        ref={head.setNodeRef}
        className={`relative flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 rounded-lg border border-dashed px-2 pb-1 pt-3 ${
          head.isOver ? "border-brand-600 bg-brand-soft" : "border-transparent"
        }`}
      >
        <span
          aria-hidden
          className={`absolute -left-[21px] top-[17px] h-3 w-3 rounded-full border-[3px] border-brand-600 max-sm:-left-[19px] ${isContent ? "bg-[rgb(var(--surface))]" : "bg-brand-600"}`}
        />
        {isContent ? (
          <>
            <span className="text-[15px] font-bold">
              <span className="font-semibold text-muted">
                {PART_ROLE_LABEL.content} {ordinal}:
              </span>{" "}
              {renaming ? (
                <RenameInput initial={part.name} onDone={onEndRename} />
              ) : (
                <span>{part.name}</span>
              )}
            </span>
            {!renaming && (
              <button type="button" className="text-[13px] font-semibold text-brand-700 hover:underline" onClick={onStartRename}>
                Đổi tên
              </button>
            )}
          </>
        ) : (
          <span className="text-[15px] font-bold">{PART_ROLE_LABEL[part.role]}</span>
        )}
        <span className="text-[13px] tabular-nums text-muted">{range}</span>
      </div>

      <ol className="space-y-2">
        {slides.map((s, j) => (
          <Row key={s.id} s={s} index={from + j} canRemove={canRemove} onOpen={() => onOpen(s.id)} onRemove={() => onRemove(s.id)} />
        ))}
      </ol>

      {!SINGLE_SLIDE_ROLES.has(part.role) && (
        <button
          ref={tail.setNodeRef}
          type="button"
          onClick={onAdd}
          className={`mb-1 ml-[74px] mt-0.5 block rounded-lg border border-dashed px-2.5 py-1 text-[13px] text-muted transition-opacity hover:text-brand-700 focus-visible:opacity-100 group-hover/part:opacity-100 max-sm:ml-[54px] [@media(hover:none)]:opacity-100 ${
            tail.isOver ? "border-brand-600 bg-brand-soft opacity-100" : "border-transparent"
          } ${dragging ? "opacity-100" : "opacity-0"}`}
        >
          + Thêm slide vào phần này
        </button>
      )}
    </li>
  );
}

function RenameInput({ initial, onDone }: { initial: string; onDone: (name: string | null) => void }) {
  const [v, setV] = useState(initial);
  const [done, setDone] = useState(false);
  const finish = (name: string | null) => {
    if (done) return;
    setDone(true);
    onDone(name);
  };
  return (
    <input
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      className="input h-8 w-[min(420px,60vw)] py-0.5 text-[15px] font-semibold"
      aria-label="Tên phần"
      value={v}
      maxLength={120}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") finish(v);
        if (e.key === "Escape") finish(null);
      }}
      onBlur={() => finish(v)}
    />
  );
}

function Row({ s, index, canRemove, onOpen, onRemove }: { s: OutlineSlide; index: number; canRemove: boolean; onOpen: () => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const interactive = s.kind !== "content";
  const { shown, more } = cardPoints(s);

  // Thẻ slide (O1): số thứ tự, tiêu đề, các ý hiện sẵn, chân thẻ ghi bố cục và nguồn. Bấm vào thẻ mở cửa sổ Sửa (không sửa trực tiếp trên thẻ).
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className="group/row flex items-stretch gap-1">
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none self-center p-1 text-faint active:cursor-grabbing"
        aria-label={`Kéo để đổi thứ tự slide ${index + 1}`}
      >
        <GripVertical size={18} />
      </button>
      <div
        className={`relative grid min-w-0 flex-1 grid-cols-[48px_minmax(0,1fr)] overflow-hidden rounded-xl border border-token bg-[rgb(var(--surface))] transition hover:border-brand-600 hover:shadow-sm sm:grid-cols-[56px_minmax(0,1fr)]`}
      >
        <div className={`grid content-center justify-items-center gap-1 border-r border-token py-2 ${interactive ? "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-200" : "bg-[rgb(var(--surface-muted))] text-brand-700"}`}>
          <span className="text-lg font-bold tabular-nums">{index + 1}</span>
          <OutlineGlyph k={glyphKey(s)} className="h-[22px] w-[34px] shrink-0 opacity-70" />
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 py-3 pl-4 pr-24 text-left sm:pr-28"
          aria-label={`Sửa slide ${index + 1}: ${s.title || "chưa có tiêu đề"}`}
        >
          <b className={`block text-[17px] leading-snug ${s.title.trim() ? "" : "font-medium text-red-700"}`}>
            {s.title.trim() || (interactive ? "Chưa có câu hỏi" : "Chưa có tiêu đề")}
          </b>
          {shown.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[14.5px] leading-snug text-[rgb(var(--text))]/80">
              {shown.map((p, i) => (
                <li key={i} className="line-clamp-2">
                  {p}
                </li>
              ))}
            </ul>
          )}
          {more > 0 && <p className="mt-0.5 pl-5 text-[13px] text-faint">và {more} ý nữa</p>}
          <small className="mt-2 block text-[13px] text-faint">{rowSubtitle(s)}</small>
        </button>
        <div className="absolute right-2 top-2 flex items-center gap-1">
          <span className="hidden rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-1 text-[13px] font-semibold text-brand-700 sm:inline">Sửa</span>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Xoá slide ${index + 1}`}
              title="Xoá slide"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint opacity-0 transition-opacity hover:bg-[rgb(var(--surface-muted))] hover:text-red-700 focus-visible:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
