"use client";

import { useState } from "react";
import {
  extractVocabWithAi,
  selectAll,
  selectedItems,
  toggleSelection,
  type AiVocabItem,
  type AiVocabSkipped,
} from "@/lib/aiVocabImport";
import AiVocabPreview from "./AiVocabPreview";

/**
 * LANG G2.5 — khung "Nhập bằng AI" trong bộ soạn từ vựng. Dán văn bản thô → AI tách
 * dòng → xem trước và chọn → `onAdd` (bộ soạn lo phần nhận biết từ trùng). Khung này
 * không bao giờ tự lưu gì.
 */
export default function AiVocabImportPanel({ onAdd }: { onAdd: (items: AiVocabItem[]) => void }) {
  const [text, setText] = useState("");
  const [fillMissing, setFillMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ items: AiVocabItem[]; skipped: AiVocabSkipped[] } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  async function analyze() {
    setBusy(true);
    setError(null);
    setResult(null);
    const r = await extractVocabWithAi(text, fillMissing);
    setBusy(false);
    if (!r.ok) {
      // Giữ nguyên ô dán để giảng viên thử lại mà không phải dán lại.
      setError(r.message);
      return;
    }
    setResult({ items: r.items, skipped: r.skipped });
    setSelected(selectAll(r.items));
  }

  function add() {
    if (!result) return;
    onAdd(selectedItems(result.items, selected));
    setResult(null);
    setText("");
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Dán văn bản từ vựng (từ giáo trình, Word, bảng tính...). AI tách thành từng dòng để bạn xem trước và kiểm tra
        rồi mới thêm vào danh sách. Văn bản dán sẽ được gửi tới dịch vụ AI (OpenAI); đừng dán thông tin cá nhân của
        học viên.
      </p>
      <textarea
        className="input text-sm"
        rows={6}
        value={text}
        maxLength={20000}
        onChange={(e) => setText(e.target.value)}
        aria-label="Dán văn bản từ vựng"
        placeholder={"你好 nǐ hǎo xin chào\n谢谢 xièxie cảm ơn\n再见 - tạm biệt"}
      />
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={fillMissing}
          onChange={(e) => setFillMissing(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          Điền phiên âm và nghĩa còn thiếu
          <span className="block text-xs text-muted">
            Tắt: AI chỉ lấy những gì có trong văn bản. Bật: AI được tự điền phần thiếu; ô nào do AI điền sẽ được đánh dấu
            để bạn kiểm tra.
          </span>
        </span>
      </label>
      <button type="button" className="btn-secondary text-sm" onClick={analyze} disabled={busy || !text.trim()}>
        {busy ? "Đang phân tích..." : "Phân tích bằng AI"}
      </button>
      {error && (
        <div className="banner-danger text-xs" role="alert">
          {error}
        </div>
      )}
      {result && (
        <AiVocabPreview
          items={result.items}
          skipped={result.skipped}
          selected={selected}
          onToggle={(i) => setSelected((s) => toggleSelection(s, i))}
          onSelectAll={() => setSelected(selectAll(result.items))}
          onSelectNone={() => setSelected(new Set())}
          onAdd={add}
        />
      )}
    </div>
  );
}
