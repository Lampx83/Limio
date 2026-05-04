"use client";

import { useState, useEffect } from "react";
import { TimerTemplate } from "@feedbackme/db";
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
    description: template?.description || "",
    minutes: template ? Math.floor(template.durationSeconds / 60) : 5,
    seconds: template ? template.durationSeconds % 60 : 0,
    notes: template?.notes || "",
    musicId: template?.musicId || "",
    courseIdValue: template?.courseId || courseId || "",
    isPublic: template?.isPublic || false,
  });

  const durationSeconds = formData.minutes * 60 + formData.seconds;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (durationSeconds < 1) {
      toast.error("Duration must be at least 1 second");
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        durationSeconds,
        notes: formData.notes.trim() || undefined,
        musicId: formData.musicId.trim() || undefined,
        courseId: formData.courseIdValue || undefined,
        isPublic: formData.isPublic,
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name */}
      <div>
        <label className="label mb-1 block text-sm font-medium">
          Template Name *
        </label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="e.g., Group Discussion - 10min"
          disabled={isLoading}
          className="input w-full"
        />
      </div>

      {/* Description */}
      <div>
        <label className="label mb-1 block text-sm font-medium">
          Description (optional)
        </label>
        <input
          type="text"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder="Short description of this template"
          disabled={isLoading}
          className="input w-full"
        />
      </div>

      {/* Duration */}
      <div>
        <label className="label mb-2 block text-sm font-medium">
          Duration *
        </label>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted">Minutes</label>
            <input
              type="number"
              name="minutes"
              value={formData.minutes}
              onChange={handleInputChange}
              min="0"
              max="999"
              disabled={isLoading}
              className="input w-full"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-muted">Seconds</label>
            <input
              type="number"
              name="seconds"
              value={formData.seconds}
              onChange={handleInputChange}
              min="0"
              max="59"
              disabled={isLoading}
              className="input w-full"
            />
          </div>
          <div className="text-sm font-semibold text-brand-600">
            {Math.floor(durationSeconds / 60)}:{(durationSeconds % 60)
              .toString()
              .padStart(2, "0")}
          </div>
        </div>
      </div>

      {/* Notes for Students */}
      <div>
        <label className="label mb-1 block text-sm font-medium">
          Instructions for Students (optional)
        </label>
        <textarea
          name="notes"
          value={formData.notes}
          onChange={handleInputChange}
          placeholder="e.g., Discuss the topic with your group members..."
          disabled={isLoading}
          rows={3}
          className="input w-full"
        />
      </div>

      {/* Music ID */}
      <div>
        <label className="label mb-1 block text-sm font-medium">
          Background Music (optional)
        </label>
        <select
          name="musicId"
          value={formData.musicId}
          onChange={handleInputChange}
          disabled={isLoading}
          className="input w-full"
        >
          <option value="">No music</option>
          <option value="upbeat">Upbeat</option>
          <option value="focus">Focus</option>
          <option value="calm">Calm</option>
          <option value="lofi">Lo-Fi</option>
        </select>
      </div>

      {/* Course (if not pre-selected) */}
      {!courseId && (
        <div>
          <label className="label mb-1 block text-sm font-medium">
            Course (optional)
          </label>
          <input
            type="text"
            name="courseIdValue"
            value={formData.courseIdValue}
            onChange={handleInputChange}
            placeholder="Leave blank for personal templates"
            disabled={isLoading}
            className="input w-full"
          />
        </div>
      )}

      {/* Is Public */}
      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isPublic"
            checked={formData.isPublic}
            onChange={handleInputChange}
            disabled={isLoading}
            className="rounded"
          />
          <span className="text-sm font-medium">
            Share with other instructors
          </span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-primary flex-1"
        >
          {isLoading
            ? "Saving..."
            : template
              ? "Update Template"
              : "Create Template"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="btn btn-secondary flex-1"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
