"use client";

import { useEffect, useState } from "react";
import { History, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { DateTime } from "@/components/ui";

type LogEvent = {
  id: string;
  occurredAt: string;
  student: string;
  action: string;
  lesson: string | null;
};

/** Nút mở log hoạt động học viên của khoá (100 dòng mới nhất) ngay tab Học viên. */
export default function ActivityLogButton({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<LogEvent[] | null>(null);
  const [limit, setLimit] = useState(100);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setEvents(null);
    setError(false);
    fetch(apiUrl(`/api/instructor/courses/${courseId}/activity-log`))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { events: LogEvent[]; limit: number }) => {
        if (cancelled) return;
        setEvents(d.events);
        setLimit(d.limit);
      })
      .catch(() => !cancelled && setError(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, courseId]);

  return (
    <>
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
        <History className="h-3.5 w-3.5" aria-hidden />
        Log hoạt động học viên
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Log hoạt động học viên"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl bg-[rgb(var(--surface))] shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--border))] p-4">
              <div>
                <h3 className="text-lg font-semibold">Log hoạt động học viên</h3>
                <p className="mt-0.5 text-sm text-muted">
                  {limit} hoạt động mới nhất của học viên trong khoá, mới nhất ở trên.
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="overflow-y-auto p-4">
              {error ? (
                <p className="text-sm text-muted">Không tải được log. Thầy/cô thử lại sau.</p>
              ) : events === null ? (
                <p className="text-sm text-muted">Đang tải…</p>
              ) : events.length === 0 ? (
                <p className="text-sm text-muted">Chưa có hoạt động nào của học viên trong khoá này.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-meta text-muted">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Thời điểm</th>
                      <th className="py-2 pr-3 font-medium">Học viên</th>
                      <th className="py-2 font-medium">Hoạt động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className="border-t border-[rgb(var(--border))] align-top">
                        <td className="whitespace-nowrap py-2 pr-3 text-muted">
                          <DateTime value={e.occurredAt} format="datetime" />
                        </td>
                        <td className="py-2 pr-3">{e.student}</td>
                        <td className="py-2">
                          {e.action}
                          {e.lesson && <span className="text-muted"> — {e.lesson}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
