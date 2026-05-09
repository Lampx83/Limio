"use client";

import { useState, useEffect } from "react";
import type { TimerTemplate } from "@feedbackme/db";
import { toast } from "@/lib/toast";
import TemplateForm from "./TemplateForm";

interface TemplateListProps {
  courseId?: string;
}

export default function TemplateList({ courseId }: TemplateListProps) {
  const [templates, setTemplates] = useState<TimerTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<TimerTemplate | null>(
    null
  );
  const [showForm, setShowForm] = useState(false);

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
  }, [courseId]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      let url = "/api/instructor/teaching-tools/timer-templates";
      if (courseId) {
        url += `?courseId=${courseId}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
      } else {
        toast.error("Failed to load templates");
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
      toast.error("Network error loading templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = (savedTemplate: TimerTemplate) => {
    if (editingTemplate) {
      setTemplates(
        templates.map((t) => (t.id === savedTemplate.id ? savedTemplate : t))
      );
    } else {
      setTemplates([savedTemplate, ...templates]);
    }
    setShowForm(false);
    setEditingTemplate(null);
  };

  const handleEdit = (template: TimerTemplate) => {
    setEditingTemplate(template);
    setShowForm(true);
  };

  const handleDelete = async (templateId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this template? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const res = await fetch(
        `/api/instructor/teaching-tools/timer-templates/${templateId}`,
        { method: "DELETE" }
      );

      if (res.ok) {
        setTemplates(templates.filter((t) => t.id !== templateId));
        toast.success("Template deleted");
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete template");
      }
    } catch (err) {
      console.error("Error deleting template:", err);
      toast.error("Network error deleting template");
    }
  };

  if (showForm) {
    return (
      <div className="rounded-2xl border border-brand-200 bg-[rgb(var(--surface))] p-6">
        <h3 className="mb-4 text-lg font-semibold">
          {editingTemplate ? "Edit Template" : "Create New Template"}
        </h3>
        <TemplateForm
          template={editingTemplate || undefined}
          courseId={courseId}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingTemplate(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Timer Templates</h2>
        <button
          onClick={() => {
            setEditingTemplate(null);
            setShowForm(true);
          }}
          className="btn btn-primary btn-sm"
        >
          + Create Template
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-8 text-center">
          <p className="text-muted">Loading templates...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && templates.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-token bg-[rgb(var(--surface-muted))] p-8 text-center">
          <p className="mb-4 text-muted">No templates yet</p>
          <button
            onClick={() => {
              setEditingTemplate(null);
              setShowForm(true);
            }}
            className="btn btn-primary"
          >
            Create your first template
          </button>
        </div>
      )}

      {/* Templates Table */}
      {!isLoading && templates.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))]">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Music</th>
                <th className="px-4 py-3">Public</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {templates.map((template) => (
                <tr
                  key={template.id}
                  className="transition-colors hover:bg-[rgb(var(--surface-muted))]"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{template.name}</p>
                      {template.description && (
                        <p className="text-xs text-muted">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    {Math.floor(template.durationSeconds / 60)}:
                    {(template.durationSeconds % 60)
                      .toString()
                      .padStart(2, "0")}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {template.musicId ? (
                      <span className="rounded bg-brand-100 px-2 py-1 text-xs font-medium text-brand-700">
                        {template.musicId}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {template.isPublic ? (
                      <span className="text-xs font-medium text-green-600">
                        ✓ Yes
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Private</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleEdit(template)}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="text-xs font-medium text-danger-600 hover:text-danger-700"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
