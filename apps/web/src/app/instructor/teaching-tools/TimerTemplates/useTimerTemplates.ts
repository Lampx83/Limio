"use client";

import { useCallback, useEffect, useState } from "react";
import type { TimerTemplate } from "@feedbackme/db";
import { toast } from "@/lib/toast";
import type { NoteSizeId } from "../../classroom/countdownNote";

const BASE = "/api/instructor/teaching-tools/timer-templates";

export interface TemplateDraft {
  durationSeconds: number;
  notes: string;
  noteSize: NoteSizeId;
  musicId: string;
}

export function useTimerTemplates(courseId?: string) {
  const [templates, setTemplates] = useState<TimerTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(courseId ? `${BASE}?courseId=${courseId}` : BASE);
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setTemplates(data.templates);
        } else {
          toast.error("Không tải được danh sách mẫu");
        }
      } catch (err) {
        console.error("Error fetching templates:", err);
        if (!cancelled) toast.error("Lỗi mạng khi tải mẫu");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const create = useCallback(
    async (name: string, draft: TemplateDraft): Promise<TimerTemplate | null> => {
      try {
        const res = await fetch(BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, ...draft, courseId }),
        });
        if (!res.ok) {
          toast.error("Không lưu được mẫu");
          return null;
        }
        const saved: TimerTemplate = await res.json();
        setTemplates((prev) => [saved, ...prev]);
        return saved;
      } catch (err) {
        console.error("Error creating template:", err);
        toast.error("Lỗi mạng khi lưu mẫu");
        return null;
      }
    },
    [courseId],
  );

  const update = useCallback(
    async (id: string, draft: TemplateDraft): Promise<TimerTemplate | null> => {
      try {
        const res = await fetch(`${BASE}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) {
          toast.error("Không cập nhật được mẫu");
          return null;
        }
        const saved: TimerTemplate = await res.json();
        setTemplates((prev) => prev.map((t) => (t.id === id ? saved : t)));
        return saved;
      } catch (err) {
        console.error("Error updating template:", err);
        toast.error("Lỗi mạng khi cập nhật mẫu");
        return null;
      }
    },
    [],
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Không xoá được mẫu");
        return false;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      return true;
    } catch (err) {
      console.error("Error deleting template:", err);
      toast.error("Lỗi mạng khi xoá mẫu");
      return false;
    }
  }, []);

  return { templates, isLoading, create, update, remove };
}
