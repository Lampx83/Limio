"use client";

import {
  columnHeaderColor,
  groupNotesByColumn,
  rotationForNote,
} from "../classroom/boardNoteStyle";
import NoteAttachment from "../classroom/NoteAttachment";

export interface BoardViewNote {
  id: string;
  authorName: string;
  content: string;
  color?: string | null;
  attachmentUrl?: string | null;
  column?: string | null;
}

// Cùng ngôn ngữ hiển thị với InteractiveBoard (host) và /join/[code] (học viên):
// màu note do người viết chọn, xoay nhẹ theo id, header cột có màu — để màn
// chiếu Limio-Live không "lệch style" so với bảng học viên đang dùng.
export default function BoardNotesView({
  notes,
  columns,
  scale = "present",
  emptyText = "Chưa có ghi chú nào...",
}: {
  notes: BoardViewNote[];
  columns: string[];
  scale?: "present" | "editor";
  emptyText?: string;
}) {
  const big = scale === "present";
  const noteText = big ? "text-[22px] leading-snug" : "text-xs leading-snug";
  const authorText = big ? "text-base" : "text-[10px]";
  const headerText = big ? "text-xl" : "text-xs";

  const NoteCard = ({ n, showColumnTag }: { n: BoardViewNote; showColumnTag?: boolean }) => {
    const rot = rotationForNote(n.id);
    return (
      <div
        className={`relative mb-4 break-inside-avoid overflow-hidden rounded-xl shadow-md ${big ? "p-5" : "p-3"}`}
        style={{ backgroundColor: n.color || "#FEF3C7", transform: `rotate(${rot})` }}
      >
        {showColumnTag && n.column && (
          <span className="mb-1.5 inline-block rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-800">
            {n.column}
          </span>
        )}
        {n.attachmentUrl && <NoteAttachment url={n.attachmentUrl} />}
        <p className={`whitespace-pre-wrap break-words font-medium text-gray-900 ${noteText}`}>{n.content}</p>
        <p className={`mt-2 font-semibold tracking-wide text-gray-700 ${authorText}`}>— {n.authorName}</p>
      </div>
    );
  };

  if (columns.length > 0) {
    const groups = groupNotesByColumn(notes, columns);
    return (
      <div className={`flex items-stretch gap-4 overflow-x-auto pb-2 ${big ? "" : "h-full"}`}>
        {groups.map((g) => (
          <div
            key={g.label}
            className={`flex shrink-0 flex-col overflow-hidden rounded-2xl bg-white/60 shadow-sm ring-1 ring-black/5 ${
              big ? "w-[22rem]" : "w-40"
            }`}
          >
            <div
              className="flex items-center justify-between gap-2 px-3 py-2.5"
              style={{ backgroundColor: columnHeaderColor(columns.indexOf(g.label)) }}
            >
              <p className={`truncate font-bold text-gray-900 ${headerText}`}>{g.label}</p>
              <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-bold text-gray-800">
                {g.notes.length}
              </span>
            </div>
            <div className={`flex-1 p-3 ${big ? "" : "overflow-y-auto"}`}>
              {g.notes.length === 0 ? (
                <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-black/10 py-6 text-xs italic text-[#9AA090]">
                  Chưa có note
                </div>
              ) : (
                g.notes.map((n) => <NoteCard key={n.id} n={n} />)
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className={`flex items-center justify-center rounded-2xl border-2 border-dashed border-[#D8D4C4] bg-[#FCFBF7] text-[#9AA090] ${big ? "min-h-[40vh]" : "h-full"}`}>
        <span className={big ? "text-xl" : "text-xs"}>{emptyText}</span>
      </div>
    );
  }

  return (
    <div
      className={`px-2 pb-4 [column-fill:_balance] ${
        big ? "columns-3 gap-5 xl:columns-4" : "h-full overflow-y-auto columns-3 gap-3"
      }`}
    >
      {notes.map((n) => (
        <NoteCard key={n.id} n={n} showColumnTag />
      ))}
    </div>
  );
}
