"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import ToggleRow from "@/components/ui/ToggleRow";

export interface LegacyOralReadinessView {
  disabled: boolean;
  exams: { total: number; draft: number; published: number };
  openSessions: number;
  inProgressAttempts: number;
  awaitingGrading: number;
}

/**
 * Công tắc tắt vấn đáp AI bản cũ (docs/tieu-chi/limio-van-dap.md). Hiện số liệu để quyết định tắt có ảnh hưởng ai
 * không, và hỏi lại khi còn buổi đang mở hoặc học viên đang thi dở.
 */
export default function LegacyOralSwitch({ initial }: { initial: LegacyOralReadinessView }) {
  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function change(disabled: boolean) {
    if (disabled && (state.openSessions > 0 || state.inProgressAttempts > 0)) {
      const ok = window.confirm(
        `Hiện còn ${state.openSessions} buổi đang mở và ${state.inProgressAttempts} lượt thi đang làm dở. ` +
          "Tắt xong, học viên không vào thêm được; ai đang thi dở vẫn làm nốt. Vẫn tắt?",
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const r = await fetch(apiUrl("/api/admin/oral-legacy"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setState((await r.json()) as LegacyOralReadinessView);
      toast.success(disabled ? "Đã tắt vấn đáp AI bản cũ" : "Đã bật lại vấn đáp AI bản cũ");
    } catch {
      toast.error("Không lưu được, thử lại sau");
    } finally {
      setSaving(false);
    }
  }

  const rows: Array<[string, number, string]> = [
    ["Đề vấn đáp cũ", state.exams.total, `${state.exams.draft} nháp · ${state.exams.published} đã xuất bản`],
    ["Buổi đang mở", state.openSessions, "Tắt xong học viên không vào được nữa"],
    ["Lượt thi đang làm dở", state.inProgressAttempts, "Vẫn được làm nốt sau khi tắt"],
    ["Bài chờ chốt điểm", state.awaitingGrading, "Vẫn chấm được sau khi tắt"],
  ];

  return (
    <section className="card mt-6">
      <header className="border-b border-token pb-4">
        <h2 className="text-base font-semibold">Vấn đáp AI bản cũ</h2>
        <p className="mt-1 text-xs text-muted">
          Tắt khi đã chuyển sang bản mới. Sau khi tắt: không tạo đề, không sửa tài liệu/chủ đề, không mở buổi, không vào
          thi mới, không thử vấn đáp. Kết quả cũ vẫn xem, chấm và xuất (Excel, Word) được.
        </p>
      </header>

      <ToggleRow
        label="Tắt vấn đáp AI bản cũ"
        description={state.disabled ? "Đang tắt." : "Đang bật — mọi chức năng như bình thường."}
        checked={state.disabled}
        disabled={saving}
        onChange={(next) => void change(next)}
      />

      <dl className="grid gap-3 border-t border-token pt-4 sm:grid-cols-2">
        {rows.map(([label, value, note]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-lg font-semibold">{value.toLocaleString("vi-VN")}</dd>
            <dd className="text-xs text-muted">{note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
