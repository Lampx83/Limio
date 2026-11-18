"use client";

import { useState, type KeyboardEvent, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronDown } from "lucide-react";
import PinyinLabel, { RubyRun, useSyllables } from "./PinyinLabel";
import { useT } from "@/lib/i18n/client";
import {
  clearSlot,
  clearToken,
  orderFromSlots,
  placeInSlot,
  placeToken,
  poolOf,
  shiftSlot,
  slotsFromOrder,
  type OrderSlots,
} from "@/lib/practiceDnd";

/**
 * Kéo-thả của Phiếu bài tập (câu Sắp xếp và Kéo thả điền), dùng @dnd-kit như Quiz/Đề thi của repo. Bốn cách làm cùng một việc, đều đi qua `lib/practiceDnd`:
 *  - kéo bằng chuột; kéo bằng cảm ứng sau một cú chạm giữ ngắn (nên cuộn trang bằng ngón tay vẫn bình thường, không kéo nhầm);
 *  - chạm-chọn: chạm mảnh (mảnh sáng lên) rồi chạm ô; chạm mảnh đã đặt để bỏ ra (quy ước tap-select của quiz matching/reorder);
 *  - bàn phím: Tab tới mảnh, Enter/Space để chọn, Tab tới ô, Enter để đặt; mảnh trong ô dùng mũi tên trái/phải để dời, Delete để bỏ ra;
 *  - ô chọn gốc ẩn (đọc màn hình): mỗi ô thứ tự / chỗ trống có một `<select>` dự phòng.
 * Pinyin dưới chữ Hán (trừ câu `questionHidesPinyin`) lấy từ ngữ cảnh của `PinyinLabel`.
 */

const collide: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : rectIntersection(args);
};

function useSheetSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Giữ ~0,16 giây mới nhấc thẻ: kéo ngón tay ngay thì là cuộn trang.
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
  );
}

function Card({
  dragId,
  label,
  selected = false,
  used = false,
  onClick,
  onKeyDown,
}: {
  dragId: string;
  label: string;
  selected?: boolean;
  used?: boolean;
  onClick: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      className="ps-card"
      aria-pressed={selected}
      data-selected={selected ? "true" : undefined}
      data-used={used ? "true" : undefined}
      data-dragging={isDragging ? "true" : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <PinyinLabel text={label} />
    </button>
  );
}

function Overlay({ activeLabel }: { activeLabel: string | null }) {
  return (
    <DragOverlay dropAnimation={null}>
      {activeLabel !== null ? (
        <div className="ps-card ps-card-overlay">
          <PinyinLabel text={activeLabel} />
        </div>
      ) : null}
    </DragOverlay>
  );
}

// ── Sắp xếp ────────────────────────────────────────────────────────────────

function OrderSlot({
  index,
  id,
  label,
  selecting,
  onClickEmpty,
  onClickCard,
  onKey,
}: {
  index: number;
  id: string | null;
  label: string;
  selecting: boolean;
  onClickEmpty: () => void;
  onClickCard: () => void;
  onKey: (e: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${index}` });
  return (
    <li ref={setNodeRef} className="ps-oslot" data-over={isOver ? "true" : undefined} data-filled={id ? "true" : undefined}>
      <span className="ps-oslot-n" aria-hidden>
        {index + 1}
      </span>
      {id ? (
        <Card dragId={`card:${id}`} label={label} onClick={onClickCard} onKeyDown={onKey} />
      ) : (
        <button type="button" className="ps-oslot-empty" data-selecting={selecting ? "true" : undefined} onClick={onClickEmpty} aria-label={`Ô ${index + 1}, trống`} />
      )}
    </li>
  );
}

function PoolArea({ children }: { children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool" });
  return (
    <ul ref={setNodeRef} className="ps-pool" data-over={isOver ? "true" : undefined} aria-label="Các mảnh để sắp xếp">
      {children}
    </ul>
  );
}

/**
 * Câu Sắp xếp: khay các mảnh (kéo được) và một hàng ô đánh số để đặt vào. Chỉ lưu `{order}` khi đủ mọi ô, như bản dùng ô chọn trước đây.
 */
export function OrderingDnd({
  n,
  items,
  order,
  onOrder,
  prompt,
}: {
  n: number;
  items: Array<{ id: string; label: string }>;
  order: string[] | null;
  onOrder: (order: string[]) => void;
  prompt: ReactNode;
}) {
  const t = useT();
  const sensors = useSheetSensors();
  const ids = items.map((i) => i.id);
  const labelOf = (id: string) => items.find((i) => i.id === id)?.label ?? "";
  const [slots, setSlots] = useState<OrderSlots>(() => slotsFromOrder(order, ids));
  const [sel, setSel] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  function commit(next: OrderSlots) {
    setSlots(next);
    setSel(null);
    const o = orderFromSlots(next);
    if (o) onOrder(o);
  }
  const idOf = (dragId: string) => dragId.replace(/^card:/, "");

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const id = idOf(String(e.active.id));
    const over = e.over ? String(e.over.id) : "";
    if (over === "pool") commit(slots.map((s) => (s === id ? null : s)));
    else if (over.startsWith("slot:")) commit(placeInSlot(slots, id, Number(over.slice(5))));
  }

  const pool = poolOf(ids, slots);
  const filled = slots.filter(Boolean).length;
  return (
    <div className="ps-dnd">
      {prompt}
      <DndContext
        sensors={sensors}
        collisionDetection={collide}
        accessibility={{ screenReaderInstructions: { draggable: "Nhấn Enter để chọn mảnh, rồi nhấn Enter ở ô muốn đặt vào." } }}
        onDragStart={(e: DragStartEvent) => setActive(idOf(String(e.active.id)))}
        onDragCancel={() => setActive(null)}
        onDragEnd={onDragEnd}
      >
        <ol className="ps-oslots" aria-label="Các ô thứ tự">
          {slots.map((id, i) => (
            <OrderSlot
              key={i}
              index={i}
              id={id}
              label={id ? labelOf(id) : ""}
              selecting={sel !== null}
              onClickEmpty={() => sel && commit(placeInSlot(slots, sel, i))}
              onClickCard={() => (sel && sel !== id ? commit(placeInSlot(slots, sel, i)) : commit(clearSlot(slots, i)))}
              onKey={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  commit(shiftSlot(slots, i, e.key === "ArrowLeft" ? -1 : 1));
                } else if (e.key === "Delete" || e.key === "Backspace") {
                  e.preventDefault();
                  commit(clearSlot(slots, i));
                }
              }}
            />
          ))}
        </ol>
        <PoolArea>
          {pool.map((id) => (
            <li key={id}>
              <Card dragId={`card:${id}`} label={labelOf(id)} selected={sel === id} onClick={() => setSel(sel === id ? null : id)} />
            </li>
          ))}
        </PoolArea>
        <Overlay activeLabel={active ? labelOf(active) : null} />
      </DndContext>
      {/* Dự phòng cho đọc màn hình: mỗi ô thứ tự một ô chọn. */}
      <div className="sr-only">
        {slots.map((id, i) => (
          <select
            key={i}
            aria-label={`Câu ${n}, vị trí ${i + 1}`}
            value={id ?? ""}
            onChange={(e) => commit(e.target.value ? placeInSlot(slots, e.target.value, i) : clearSlot(slots, i))}
          >
            <option value="">—</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.label}
              </option>
            ))}
          </select>
        ))}
      </div>
      {filled < slots.length && <p className="ps-hint">{`Đặt đủ các mảnh vào ô (${filled}/${slots.length}).`}</p>}
      <p className="sr-only">{t("practice.sheet.hintOrder")}</p>
    </div>
  );
}

// ── Kéo thả điền ───────────────────────────────────────────────────────────

/**
 * Chỗ trống của câu Kéo thả điền: MỘT ô có viền và nền nhạt, cao bằng một chữ Hán kèm pinyin, rộng đủ cho 2-3 chữ. Lớp hiển thị (từ đã chọn có pinyin dưới chữ,
 * chưa chọn thì mũi tên xổ xuống) phủ lên `<select>` gốc trong suốt, nên bàn phím, đọc màn hình và bộ chọn của điện thoại vẫn là của `<select>`.
 * Đang chọn một từ ở ngân hàng thì ô nhận chạm để đặt từ đó. Có từ hai chỗ trống trở lên thì mỗi ô mang số thứ tự nhỏ ở góc.
 */
function FillSlot({
  slotKey,
  tokens,
  value,
  onChange,
  label,
  number,
  picking,
  onPlaceSelected,
}: {
  slotKey: string;
  tokens: Array<{ id: string; label: string }>;
  value: string;
  onChange: (tokenId: string) => void;
  label: string;
  number: number | null;
  /** Đang có một từ được chọn ở ngân hàng: chạm ô là đặt từ đó. */
  picking: boolean;
  onPlaceSelected: () => void;
}) {
  const hs = useSyllables();
  const { setNodeRef, isOver } = useDroppable({ id: `fill:${slotKey}` });
  const chosen = tokens.find((t) => t.id === value);
  return (
    <span
      ref={setNodeRef}
      className="ps-slot"
      data-filled={chosen ? "true" : undefined}
      data-over={isOver ? "true" : undefined}
      data-picking={picking ? "true" : undefined}
      onClick={picking ? onPlaceSelected : undefined}
    >
      {number !== null && (
        <span className="ps-slot-n" aria-hidden>
          {number}
        </span>
      )}
      <span className="ps-slot-face" aria-hidden>
        {chosen ? <PinyinLabel text={chosen.label} /> : <ChevronDown size={16} className="ps-slot-chev" />}
      </span>
      <select className="ps-slot-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">—</option>
        {tokens.map((t) => {
          const py = hs?.(t.label)?.filter(Boolean).join(" ");
          return (
            <option key={t.id} value={t.id}>
              {py ? `${t.label} (${py})` : t.label}
            </option>
          );
        })}
      </select>
    </span>
  );
}

type FillSeg = { kind: "text"; text: string } | { kind: "slot"; slot: string };

/** Dấu câu đứng ngay sau chỗ trống đi liền ô, không rơi xuống đầu dòng một mình. */
const LEAD_PUNCT = /^[，。、！？；：…）」”’)!?.,;:]+/;

/**
 * Câu Kéo thả điền: ngân hàng từ (kéo được, hoặc chạm-chọn) và câu có các chỗ trống. Giữ dạng đáp án `{placed: {[chỗ trống]: id từ}}`.
 * Mỗi từ dùng một lần: đặt từ đang ở chỗ khác thì chuyển sang chỗ mới (`placeToken`).
 */
export function DragFillDnd({
  n,
  tokens,
  segs,
  slices,
  placed,
  onPlaced,
}: {
  n: number;
  tokens: Array<{ id: string; label: string }>;
  segs: FillSeg[];
  /** Pinyin theo từng đoạn chữ của `segs` (đề có pinyin), hoặc null. */
  slices: string[][] | null;
  placed: Record<string, string>;
  onPlaced: (next: Record<string, string>) => void;
}) {
  const t = useT();
  const sensors = useSheetSensors();
  const [sel, setSel] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const used = new Set(Object.values(placed).filter(Boolean));
  const slotCount = segs.filter((s) => s.kind === "slot").length;
  const labelOf = (id: string) => tokens.find((x) => x.id === id)?.label ?? "";

  function put(slot: string, tokenId: string) {
    setSel(null);
    onPlaced(tokenId ? placeToken(placed, slot, tokenId) : clearToken(placed, slot));
  }
  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const id = String(e.active.id).replace(/^tok:/, "");
    const over = e.over ? String(e.over.id) : "";
    if (over.startsWith("fill:")) put(over.slice(5), id);
  }

  let ti = 0;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      accessibility={{ screenReaderInstructions: { draggable: "Nhấn Enter để chọn từ, rồi chọn chỗ trống muốn đặt vào." } }}
      onDragStart={(e: DragStartEvent) => setActive(String(e.active.id).replace(/^tok:/, ""))}
      onDragCancel={() => setActive(null)}
      onDragEnd={onDragEnd}
    >
      <ul className="ps-box ps-words" aria-label="Các từ để chọn">
        {tokens.map((tk) => (
          <li key={tk.id}>
            <Card dragId={`tok:${tk.id}`} label={tk.label} used={used.has(tk.id)} selected={sel === tk.id} onClick={() => setSel(sel === tk.id ? null : tk.id)} />
          </li>
        ))}
      </ul>
      <div className={`ps-drag-line ${slices ? "han-text ruby-line" : ""}`} lang={slices ? "zh-Hans" : undefined}>
        {segs.map((s, i) => {
          if (s.kind === "slot") {
            const next = segs[i + 1];
            const lead = next?.kind === "text" ? (LEAD_PUNCT.exec(next.text)?.[0] ?? "") : "";
            const slot = (
              <FillSlot
                slotKey={s.slot}
                tokens={tokens}
                value={placed[s.slot] ?? ""}
                onChange={(id) => put(s.slot, id)}
                label={`Câu ${n}, chỗ trống ${s.slot}`}
                number={slotCount > 1 ? Number(s.slot) : null}
                picking={sel !== null}
                onPlaceSelected={() => sel && put(s.slot, sel)}
              />
            );
            return lead ? (
              <span key={i} className="whitespace-nowrap">
                {slot}
                {lead}
              </span>
            ) : (
              <span key={i}>{slot}</span>
            );
          }
          const prev = segs[i - 1];
          const body = prev?.kind === "slot" ? s.text.replace(LEAD_PUNCT, "") : s.text;
          const sl = slices ? slices[ti++]! : null;
          return sl ? <RubyRun key={i} text={body} syllables={sl} /> : <span key={i}>{body}</span>;
        })}
      </div>
      <p className="sr-only">{t("practice.sheet.hintDrag")}</p>
      <Overlay activeLabel={active ? labelOf(active) : null} />
    </DndContext>
  );
}
