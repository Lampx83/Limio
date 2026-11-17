"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Layers, LayoutGrid } from "lucide-react";
import VocabFlashcards from "@/components/VocabFlashcards";
import type { VocabViewItem } from "@/components/VocabListView";
import { parseVocabTable } from "@/lib/lessonVocabRuby";
import { hskT } from "./hskT";
import HanziStrokeDialog from "./HanziStrokeDialog";
import type { UiLang } from "@/lib/i18n/core";

/**
 * Mục Từ mới của bài HSK: nút chuyển giữa "Thẻ từ" (lưới thẻ, `children`) và "Flashcard" (thẻ lật từng từ, dùng lại `VocabFlashcards`).
 * Flashcard dựng từ chính bảng từ mới của sách (đủ từ, đúng thứ tự, gồm cả tên riêng), nên không phụ thuộc danh sách thẻ ghi nhớ riêng của bài.
 * Không đọc được bảng thì không có nút chuyển, chỉ còn lưới thẻ.
 */
export default function HskVocabSwitch({ html, children, lang = "vi" }: { html: string; children: React.ReactNode; lang?: UiLang }) {
  const t = (key: Parameters<typeof hskT>[1]) => hskT(lang, key);
  const [view, setView] = useState<"cards" | "flash">("cards");
  const [strokeTerm, setStrokeTerm] = useState<string | null>(null);
  // Flashcard: che pinyin để tự đoán cách đọc (mặt trước chỉ còn chữ Hán); bật lại để xem.
  const [showReading, setShowReading] = useState(true);
  const [rows, setRows] = useState<ReturnType<typeof parseVocabTable>>(null);
  useEffect(() => {
    setRows(parseVocabTable(html));
  }, [html]);
  const items = useMemo<VocabViewItem[]>(
    () => (rows ?? []).map((r, i) => ({ id: `hsk-vocab-${i}`, term: r.term, reading: r.reading || undefined, meaning: r.meaning, note: r.pos || undefined })),
    [rows],
  );
  const canSwitch = items.length > 0;
  return (
    <div>
      {canSwitch && (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          {view === "flash" && (
            <button
              type="button"
              aria-pressed={showReading}
              onClick={() => setShowReading((v) => !v)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-token px-3.5 text-sm transition-colors ${
                showReading ? "bg-brand-100 font-medium text-brand-800 shadow-sm" : "bg-[rgb(var(--surface))] text-muted line-through hover:bg-brand-soft"
              }`}
            >
              {showReading ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
              {t("learn.hsk.vocab.pinyin")}
            </button>
          )}
          <div role="group" aria-label={t("learn.hsk.vocab.viewAria")} className="inline-flex h-9 items-center gap-0.5 rounded-full border border-token bg-[rgb(var(--surface))] p-0.5">
            {(
              [
                ["cards", t("learn.hsk.vocab.cards"), LayoutGrid],
                ["flash", t("learn.hsk.vocab.flash"), Layers],
              ] as const
            ).map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                aria-pressed={view === k}
                onClick={() => setView(k)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors ${
                  view === k ? "bg-brand-100 font-medium text-brand-800 shadow-sm" : "text-muted hover:bg-brand-soft"
                }`}
              >
                <Icon size={14} aria-hidden />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {view === "flash" && canSwitch ? <VocabFlashcards items={items} showReading={showReading} playingId={null} onToggleAudio={() => undefined} /> : (
        // Bấm (hoặc Enter/Space) vào thẻ từ có chữ Hán thì mở "Cách viết": thẻ là HTML dựng sẵn nên lắng nghe ở khung ngoài.
        <div
          onClick={(e) => {
            const term = (e.target as Element).closest?.(".hsk-wc[data-term]")?.getAttribute("data-term");
            if (term) setStrokeTerm(term);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            const card = (e.target as Element).closest?.(".hsk-wc[data-term]");
            if (card && e.target === card) {
              e.preventDefault();
              setStrokeTerm(card.getAttribute("data-term"));
            }
          }}
        >
          {children}
        </div>
      )}
      {strokeTerm && <HanziStrokeDialog term={strokeTerm} lang={lang} onClose={() => setStrokeTerm(null)} />}
    </div>
  );
}
