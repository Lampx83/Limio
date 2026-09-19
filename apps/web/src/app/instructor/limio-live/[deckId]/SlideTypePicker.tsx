"use client";

import { useEffect } from "react";
import { AlignLeft, BarChart3, Cloud, FileUp, ListChecks, StickyNote, X, type LucideIcon } from "lucide-react";
import { RESOURCE_TYPES, RESOURCE_TYPE_HINTS, RESOURCE_TYPE_ICONS } from "../ResourceEditor";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "../ResourceContent";

export type SlideChoice =
  | { type: "content"; resourceKind?: ResourceType }
  | { type: "quiz" | "poll" | "word_cloud" | "collaborate_board" };

interface Tile {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  choice: SlideChoice;
}

// 9 loại slide trình bày: 1 kiểu "Tiêu đề & ý chính" + 8 loại theo tài nguyên nhúng được.
const CONTENT_TILES: Tile[] = [
  {
    key: "text",
    label: "Tiêu đề & ý chính",
    hint: "Tiêu đề, phụ đề, gạch đầu dòng và ảnh minh hoạ",
    icon: AlignLeft,
    choice: { type: "content" },
  },
  ...RESOURCE_TYPES.map((rt) => ({
    key: rt,
    label: RESOURCE_TYPE_LABELS[rt],
    hint: RESOURCE_TYPE_HINTS[rt],
    icon: RESOURCE_TYPE_ICONS[rt],
    choice: { type: "content", resourceKind: rt } as SlideChoice,
  })),
];

const INTERACTIVE_TILES: Tile[] = [
  { key: "quiz", label: "Trắc nghiệm", hint: "Câu hỏi 1 đáp án đúng, chấm tức thì", icon: ListChecks, choice: { type: "quiz" } },
  { key: "poll", label: "Thăm dò", hint: "Lấy ý kiến cả lớp, không chấm điểm", icon: BarChart3, choice: { type: "poll" } },
  { key: "word_cloud", label: "Word Cloud", hint: "Thu thập từ khoá thành đám mây chữ", icon: Cloud, choice: { type: "word_cloud" } },
  { key: "collaborate_board", label: "Bảng cộng tác", hint: "Học viên dán ghi chú lên bảng chung", icon: StickyNote, choice: { type: "collaborate_board" } },
];

// Một lưới phẳng duy nhất: mọi loại slide (tài nguyên + tương tác + tách PDF) ngang hàng nhau.
// Ô cờ vua: 2 tông nền xen kẽ theo (hàng + cột) để lưới đọc như bàn cờ.
const COLS = 4;

export default function SlideTypePicker({
  onPick,
  onImportPdf,
  onClose,
  pdfNote,
}: {
  onPick: (choice: SlideChoice) => void;
  onImportPdf: () => void;
  onClose: () => void;
  pdfNote: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pdfSplit: Tile = {
    key: "pdf-split",
    label: "Tách PDF thành slide",
    hint: pdfNote,
    icon: FileUp,
    choice: { type: "content" },
  };
  const tiles = [...CONTENT_TILES, ...INTERACTIVE_TILES, pdfSplit].map((t) => ({
    ...t,
    onClick: t.key === "pdf-split" ? onImportPdf : () => onPick(t.choice),
  }));

  return (
    <div className="fixed inset-0 z-50 flex animate-overlay-in items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Chọn loại slide"
        className="max-h-[90vh] w-full max-w-2xl animate-dialog-in overflow-y-auto rounded-2xl border border-token bg-[rgb(var(--surface))] p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold">Chọn loại slide</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-faint hover:bg-[rgb(var(--surface-muted))]" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {tiles.map((t, i) => {
            const Icon = t.icon;
            const dark = (Math.floor(i / COLS) + (i % COLS)) % 2 === 1;
            return (
              <button
                key={t.key}
                onClick={t.onClick}
                title={t.hint}
                className={`flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-xl border border-transparent p-3 text-center transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md ${
                  dark ? "bg-brand-50 dark:bg-brand-900/20" : "bg-[rgb(var(--surface-muted))]"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-brand-700 shadow-sm">
                  <Icon size={20} />
                </span>
                <span className="text-[13px] font-semibold leading-tight text-[rgb(var(--text))]">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
