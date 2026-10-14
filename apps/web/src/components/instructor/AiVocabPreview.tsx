"use client";

import { filledLabel, type AiVocabItem, type AiVocabSkipped } from "@/lib/aiVocabImport";

/**
 * LANG G2.5 — bản xem trước kết quả "Nhập từ vựng bằng AI". AI chỉ đề xuất: giảng viên
 * chọn dòng, thấy rõ ô nào do AI tự điền, rồi mới thêm vào danh sách. Mọi chữ là text
 * node — chữ do AI trả về không bao giờ thành HTML.
 */
export default function AiVocabPreview({
  items,
  skipped,
  selected,
  onToggle,
  onSelectAll,
  onSelectNone,
  onAdd,
}: {
  items: AiVocabItem[];
  skipped: AiVocabSkipped[];
  selected: ReadonlySet<number>;
  onToggle: (index: number) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  onAdd: () => void;
}) {
  return (
    <section aria-label="Kết quả phân tích của AI" className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-sm font-medium">{`${items.length} dòng nhận được`}</p>
        {skipped.length > 0 && <p className="text-xs text-muted">{`${skipped.length} dòng bị bỏ qua`}</p>}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted">Không tìm thấy từ vựng nào trong văn bản.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" onClick={onSelectAll} className="rounded border border-token px-2 py-0.5">
              Chọn tất cả
            </button>
            <button type="button" onClick={onSelectNone} className="rounded border border-token px-2 py-0.5">
              Bỏ chọn tất cả
            </button>
          </div>

          <ul className="divide-y divide-[rgb(var(--border))] rounded-lg border border-token">
            {items.map((it, i) => (
              <li key={i} className="flex gap-3 p-3">
                <input
                  type="checkbox"
                  aria-label={`Chọn từ ${it.term}`}
                  checked={selected.has(i)}
                  onChange={() => onToggle(i)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-body">
                    <span className="font-medium">{it.term}</span>
                    {it.reading && <span className="ml-2 text-muted">{it.reading}</span>}
                  </p>
                  <p className="text-sm">{it.meaning}</p>
                  {it.example && (
                    <p className="text-meta">
                      <span>{it.example}</span>
                      {it.exampleReading && <span className="ml-2">{it.exampleReading}</span>}
                      {it.exampleMeaning && <span className="ml-2 text-muted">{it.exampleMeaning}</span>}
                    </p>
                  )}
                  {it.note && <p className="text-caption">{it.note}</p>}
                  {it.filled.length > 0 && (
                    <p className="text-caption text-warning-700">{`AI điền: ${filledLabel(it.filled)} — hãy kiểm tra`}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <button type="button" onClick={onAdd} disabled={selected.size === 0} className="btn-primary text-sm">
            {`Thêm ${selected.size} dòng đã chọn`}
          </button>
        </>
      )}

      {skipped.length > 0 && (
        <div className="rounded-lg bg-[rgb(var(--surface-muted))] p-3">
          <p className="text-xs font-medium">Các dòng bị bỏ qua</p>
          <ul className="mt-1 list-disc pl-4 text-xs text-muted">
            {skipped.map((s, i) => (
              <li key={i}>{s.term ? `${s.reason} — ${s.term}` : s.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
