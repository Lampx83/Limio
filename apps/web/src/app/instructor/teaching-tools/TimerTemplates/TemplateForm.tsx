"use client";

import { useState, useEffect } from "react";
import type { TimerTemplate } from "@feedbackme/db";
import { toast } from "@/lib/toast";

interface TemplateFormProps {
  template?: TimerTemplate;
  courseId?: string;
  onSave: (template: TimerTemplate) => void;
  onCancel: () => void;
}

export default function TemplateForm({
  template,
  courseId,
  onSave,
  onCancel,
}: TemplateFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: template?.name || "",
    notes: template?.notes || "",
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Vui lòng nhập tên mẫu");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        notes: formData.notes.trim() || undefined,
        durationSeconds: template?.durationSeconds ?? 300,
      };

      const url = template
        ? `/api/instructor/teaching-tools/timer-templates/${template.id}`
        : "/api/instructor/teaching-tools/timer-templates";

      const method = template ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || `Failed to ${template ? "update" : "create"} template`);
        return;
      }

      const savedTemplate = await res.json();
      toast.success(
        `Template ${template ? "updated" : "created"} successfully`
      );
      onSave(savedTemplate);
    } catch (err) {
      console.error("Error saving template:", err);
      toast.error("Network error saving template");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Tên mẫu *</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="VD: Thảo luận nhóm"
          disabled={isLoading}
          className="input w-full"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Hướng dẫn cho sinh viên</label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleInputChange}
          placeholder="VD: Thảo luận với nhóm về chủ đề..."
          disabled={isLoading}
          rows={3}
          className="input w-full"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={isLoading} className="btn btn-primary flex-1">
          {isLoading ? "Đang lưu..." : template ? "Cập nhật" : "Tạo mẫu"}
        </button>
        <button type="button" onClick={onCancel} disabled={isLoading} className="btn btn-secondary flex-1">
          Huỷ
        </button>
      </div>
    </form>
  );
}
