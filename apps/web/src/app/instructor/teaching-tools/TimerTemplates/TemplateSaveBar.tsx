"use client";

import { useState } from "react";
import { Plus, Save } from "lucide-react";
import type { TimerTemplate } from "@feedbackme/db";
import { toast } from "@/lib/toast";
import type { TemplateDraft } from "./useTimerTemplates";

interface TemplateSaveBarProps {
  draft: TemplateDraft;
  selectedTemplate: TimerTemplate | null;
  onCreate: (name: string, draft: TemplateDraft) => Promise<TimerTemplate | null>;
  onUpdate: (id: string, draft: TemplateDraft) => Promise<TimerTemplate | null>;
  onSaved: (template: TimerTemplate) => void;
}

const btn =
  "inline-flex items-center gap-1.5 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-fg transition hover:bg-[rgb(var(--surface-muted))] disabled:opacity-50";

export default function TemplateSaveBar({
  draft,
  selectedTemplate,
  onCreate,
  onUpdate,
  onSaved,
}: TemplateSaveBarProps) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Đặt tên cho mẫu trước khi lưu.");
      return;
    }
    setBusy(true);
    const saved = await onCreate(trimmed, draft);
    setBusy(false);
    if (!saved) return;
    onSaved(saved);
    setNaming(false);
    setName("");
    toast.success(`Đã lưu mẫu "${saved.name}"`);
  };

  const handleUpdate = async () => {
    if (!selectedTemplate) return;
    setBusy(true);
    const saved = await onUpdate(selectedTemplate.id, draft);
    setBusy(false);
    if (saved) toast.success(`Đã cập nhật mẫu "${saved.name}"`);
  };

  return (
    <div className="border-t border-token pt-3">
      {naming ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setNaming(false);
            }}
            maxLength={100}
            placeholder="Tên mẫu, ví dụ Thảo luận nhóm"
            aria-label="Tên mẫu"
            className="input h-10 min-w-[200px] flex-1"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy}
            className="inline-flex items-center rounded-lg bg-brand-gradient px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Đang lưu…" : "Lưu mẫu"}
          </button>
          <button type="button" onClick={() => setNaming(false)} disabled={busy} className={btn}>
            Huỷ
          </button>
          {error && <p className="w-full text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {selectedTemplate && (
            <button type="button" onClick={handleUpdate} disabled={busy} className={btn}>
              <Save size={14} /> {busy ? "Đang lưu…" : `Cập nhật mẫu "${selectedTemplate.name}"`}
            </button>
          )}
          <button type="button" onClick={() => setNaming(true)} disabled={busy} className={btn}>
            <Plus size={14} /> Lưu thành mẫu mới
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        Mẫu lưu lại thời gian, ghi chú và nhạc nền. Chỉ mình bạn thấy mẫu của mình.
      </p>
    </div>
  );
}
