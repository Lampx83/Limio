"use client";

import { X } from "lucide-react";
import type { TimerTemplate } from "@feedbackme/db";
import { toast } from "@/lib/toast";
import { formatDurationLabel } from "../../classroom/countdownTime";

interface TemplateSelectorProps {
  templates: TimerTemplate[];
  isLoading: boolean;
  selectedTemplateId: string | null;
  onSelectTemplate: (template: TimerTemplate | null) => void;
  onDeleteTemplate: (template: TimerTemplate) => Promise<boolean>;
}

export default function TemplateSelector({
  templates,
  isLoading,
  selectedTemplateId,
  onSelectTemplate,
  onDeleteTemplate,
}: TemplateSelectorProps) {
  const handleDelete = async (template: TimerTemplate) => {
    if (!window.confirm(`Xoá mẫu "${template.name}"? Không thể hoàn tác.`)) return;
    if (await onDeleteTemplate(template)) {
      if (template.id === selectedTemplateId) onSelectTemplate(null);
      toast.success(`Đã xoá mẫu "${template.name}"`);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Mẫu hoạt động của bạn</p>

      <div className="flex flex-wrap items-stretch gap-2">
        {isLoading && <span className="text-sm text-muted">Đang tải mẫu…</span>}

        {!isLoading && templates.length === 0 && (
          <span className="text-sm text-muted">
            Chưa có mẫu. Đặt thời gian, soạn ghi chú rồi bấm "Lưu thành mẫu mới" ở bên dưới.
          </span>
        )}

        {templates.map((template) => {
          const active = template.id === selectedTemplateId;
          return (
            <div
              key={template.id}
              className={`inline-flex items-stretch overflow-hidden rounded-lg border text-sm transition ${
                active
                  ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "border-token bg-[rgb(var(--surface))] text-fg"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectTemplate(active ? null : template)}
                aria-pressed={active}
                className="px-3 py-1.5 text-left hover:bg-[rgb(var(--surface-muted))]"
              >
                <span className="block font-medium leading-tight">{template.name}</span>
                <span className="block text-xs text-muted">
                  {formatDurationLabel(template.durationSeconds)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(template)}
                aria-label={`Xoá mẫu ${template.name}`}
                title="Xoá mẫu"
                className="border-l border-token px-2.5 text-muted hover:bg-[rgb(var(--surface-muted))] hover:text-fg"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
