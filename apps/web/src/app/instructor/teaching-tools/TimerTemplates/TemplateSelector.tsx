"use client";

import { useEffect, useState } from "react";
import { TimerTemplate } from "@feedbackme/db";
import { toast } from "@/lib/toast";

interface TemplateSelectorProps {
  courseId?: string;
  selectedTemplateId: string | null;
  onSelectTemplate: (template: TimerTemplate | null) => void;
}

export default function TemplateSelector({
  courseId,
  selectedTemplateId,
  onSelectTemplate,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<TimerTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Fetch templates on mount and when courseId changes
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
        console.error("Failed to fetch templates");
        toast.error("Failed to load templates");
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
      toast.error("Network error loading templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "") {
      onSelectTemplate(null);
    } else {
      const template = templates.find((t) => t.id === value);
      if (template) {
        onSelectTemplate(template);
      }
    }
  };

  const handleRefresh = async () => {
    await fetchTemplates();
    toast.success("Templates refreshed");
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="label mb-1 block text-sm font-medium">
          Timer Template
        </label>
        <div className="flex gap-2">
          <select
            value={selectedTemplateId || ""}
            onChange={handleSelectChange}
            disabled={isLoading}
            className="input flex-1"
          >
            <option value="">No template (manual setup)</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} ({Math.floor(template.durationSeconds / 60)}m{template.durationSeconds % 60}s)
              </option>
            ))}
          </select>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn btn-secondary btn-sm"
            title="Refresh templates"
          >
            🔄
          </button>
        </div>
      </div>

      {selectedTemplateId && templates.length > 0 && (
        <div className="rounded border border-green-200 bg-green-50 p-3">
          <p className="text-xs font-medium text-green-800">
            ✓ Template selected
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-secondary btn-sm text-xs"
        >
          + Create template
        </button>
        <a
          href="/instructor/teaching-tools/templates"
          className="btn btn-secondary btn-sm text-xs"
        >
          Manage templates →
        </a>
      </div>
    </div>
  );
}
