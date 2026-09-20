"use client";

import { useEffect, type ComponentType } from "react";
import { BarChart3, Brush, FileUp, ListChecks, PenLine, X, type LucideIcon, type LucideProps } from "lucide-react";
import { RESOURCE_TYPES, RESOURCE_TYPE_HINTS, RESOURCE_TYPE_ICONS } from "../ResourceEditor";
import { RESOURCE_TYPE_LABELS, type ResourceType } from "../ResourceContent";

export type SlideChoice =
  | { type: "content"; resourceKind?: ResourceType }
  | { type: "quiz" | "poll" | "word_cloud" }
  // "Draw-it": cùng loại slide Dán Note nhưng mode "drawing" — học viên vẽ 1 hình rồi đăng lên bảng.
  | { type: "collaborate_board"; mode?: "drawing" };

// Đám mây chữ thật: vài từ to nhỏ khác nhau xếp cụm, một màu theo màu chữ của ô — lucide không có icon này.
// Vẽ lớn hơn cỡ icon được truyền vào (×1.5) vì chữ cần chỗ mới đọc được; ô chứa không cắt phần tràn.
export function WordCloudIcon({ size = 28, strokeWidth = 2 }: LucideProps) {
  const px = Number(size) * 1.5;
  return (
    <svg width={px} height={px} viewBox="0 0 40 40" fill="currentColor" fontWeight={Number(strokeWidth) < 2 ? 600 : 800} fontFamily="system-ui, sans-serif" textAnchor="middle" aria-hidden>
      <text x="20" y="22" fontSize="16">học</text>
      <text x="9" y="9" fontSize="8">AI</text>
      <text x="30" y="10" fontSize="9">lớp</text>
      <text x="9" y="34" fontSize="9">vui</text>
      <text x="30" y="35" fontSize="10">mới</text>
    </svg>
  );
}

// Bảng cộng tác: 2 tờ ghi chú nét viền, tờ phía trước được gim bằng ghim — giống Padlet. Không tô màu, theo màu chữ của ô.
// viewBox 40 (lucide là 24) nên nhân nét ×40/24 để độ dày trông đúng bằng các icon lucide cùng size.
export function CollabBoardIcon({ size = 28, strokeWidth = 2 }: LucideProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={Number(strokeWidth) * (40 / 24)} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <g transform="rotate(-8 12 24)">
        <rect x="3" y="12" width="20" height="20" rx="2" />
        <path d="M7 19h12M7 24h8" />
      </g>
      <g transform="rotate(6 28 22)">
        <rect x="16" y="9" width="21" height="22" rx="2" fill="rgb(var(--surface))" />
        <path d="M20 19h13M20 24h13M20 29h7" />
        <circle cx="26.5" cy="10" r="3.5" fill="rgb(var(--surface))" />
      </g>
    </svg>
  );
}

interface Tile {
  key: string;
  label: string;
  hint: string;
  sub?: string;
  icon: LucideIcon | ComponentType<LucideProps>;
  choice: SlideChoice;
}

// Slide trình bày: 1 kiểu "Tiêu đề & ý chính" + các loại theo tài nguyên nhúng được (một số bị ẩn khỏi bảng chọn, xem HIDDEN_KEYS).
const CONTENT_TILES: Tile[] = [
  {
    key: "text",
    label: "Văn bản",
    hint: "Tiêu đề, phụ đề, gạch đầu dòng và ảnh minh hoạ",
    icon: PenLine,
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
  { key: "poll", label: "Vote", hint: "Lấy ý kiến cả lớp, không chấm điểm", icon: BarChart3, choice: { type: "poll" } },
  { key: "word_cloud", label: "Word Cloud", hint: "Thu thập từ khoá thành đám mây chữ", icon: WordCloudIcon, choice: { type: "word_cloud" } },
  { key: "collaborate_board", label: "Dán Note", hint: "Học viên dán ghi chú lên bảng chung", icon: CollabBoardIcon, choice: { type: "collaborate_board" } },
  { key: "draw", label: "Draw-it (vẽ)", hint: "Mỗi học viên tự vẽ 1 hình rồi đăng lên bảng chung", icon: Brush, choice: { type: "collaborate_board", mode: "drawing" } },
];

// Một lưới phẳng duy nhất: mọi loại slide (tài nguyên + tương tác + tách PDF) ngang hàng nhau, cùng một kiểu thẻ.

// Loại hay dùng — xếp lên đầu theo thứ tự này, các loại còn lại nối tiếp phía sau.
const POPULAR_KEYS = ["poll", "quiz", "word_cloud", "collaborate_board", "draw", "video", "pdf-split", "text"];

export default function SlideTypePicker({
  onPick,
  onImportPdf,
  onClose,
  pdfNote,
  pdfLimit,
}: {
  onPick: (choice: SlideChoice) => void;
  onImportPdf: () => void;
  onClose: () => void;
  pdfNote: string;
  pdfLimit: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pdfSplit: Tile = {
    key: "pdf-split",
    label: "PDF",
    hint: pdfNote,
    sub: pdfLimit,
    icon: FileUp,
    choice: { type: "content" },
  };
  // "richtext" (văn bản), "pdf" (nhúng nguyên file), "file" (đính kèm) và "external_link" không còn trong bảng chọn; slide cũ vẫn hiển thị bình thường.
  const HIDDEN_KEYS = ["richtext", "pdf", "file", "external_link"];
  const all = [...CONTENT_TILES.filter((t) => !HIDDEN_KEYS.includes(t.key)), ...INTERACTIVE_TILES, pdfSplit];
  const popular = POPULAR_KEYS.map((k) => all.find((t) => t.key === k)).filter((t): t is Tile => !!t);
  // Nhóm ít dùng xếp cuối: Embed, rồi HTML và Markdown (loại cho người rành kỹ thuật) nằm cạnh nhau ở cuối.
  const TAIL_KEYS = ["html_block", "markdown"];
  const others = [
    ...all.filter((t) => !POPULAR_KEYS.includes(t.key) && !TAIL_KEYS.includes(t.key)),
    ...TAIL_KEYS.map((k) => all.find((t) => t.key === k)).filter((t): t is Tile => !!t),
  ];
  const tiles = [...popular, ...others].map((t) => ({
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

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={t.onClick}
                title={t.hint}
                className="group flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl border border-token bg-[rgb(var(--surface))] p-3 text-center transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-md"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-100 dark:bg-brand-900/30">
                  <Icon size={26} strokeWidth={1.5} />
                </span>
                <span className="text-sm font-semibold leading-tight text-[rgb(var(--text))]">{t.label}</span>
                {t.sub && <span className="-mt-1 text-[11px] leading-tight text-faint">{t.sub}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
