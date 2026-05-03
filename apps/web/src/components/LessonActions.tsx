"use client";

import { useEffect, useState } from "react";

interface Note {
  id: string;
  body: string;
  timestampSec: number | null;
  createdAt: string;
}

export default function LessonActions({
  lessonId,
  courseSlug,
  initiallyCompleted,
  initialResumeSec,
  nextLessonId,
}: {
  lessonId: string;
  courseSlug: string;
  initiallyCompleted: boolean;
  initialResumeSec: number;
  nextLessonId: string | null;
}) {
  const [completed, setCompleted] = useState(initiallyCompleted);
  const [completing, setCompleting] = useState(false);
  const [position, setPosition] = useState(initialResumeSec);
  const [savingPos, setSavingPos] = useState(false);
  const [posSaved, setPosSaved] = useState(false);

  // Fire one lesson.viewed on mount so resume position + last lesson update.
  useEffect(() => {
    fetch(`/api/lessons/${lessonId}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionSec: initialResumeSec }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function onComplete() {
    setCompleting(true);
    const res = await fetch(`/api/lessons/${lessonId}/complete`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCompleted(true);
      if (data.courseCompleted) {
        // Bounce to course page, which shows the celebration banner.
        window.location.href = `/learn/${courseSlug}`;
      }
    }
    setCompleting(false);
  }

  async function onSavePosition() {
    setSavingPos(true);
    setPosSaved(false);
    await fetch(`/api/lessons/${lessonId}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionSec: position }),
    });
    setSavingPos(false);
    setPosSaved(true);
    setTimeout(() => setPosSaved(false), 2000);
  }

  return (
    <div className="mt-8 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">
            {completed ? "✓ Đã hoàn thành" : "Chưa hoàn thành"}
          </p>
          {!completed && (
            <p className="mt-1 text-xs text-slate-500">
              Click nút bên phải khi bạn đã hiểu nội dung.
            </p>
          )}
        </div>
        {!completed && (
          <button
            onClick={onComplete}
            disabled={completing}
            className="rounded bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {completing ? "Đang lưu..." : "Đánh dấu hoàn thành"}
          </button>
        )}
        {completed && nextLessonId && (
          <a
            href={`/learn/${courseSlug}/lessons/${nextLessonId}`}
            className="rounded bg-slate-900 px-4 py-2 font-medium text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Bài tiếp theo →
          </a>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <label className="text-xs text-slate-500">Vị trí xem (giây):</label>
        <input
          type="number"
          min={0}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="w-24 rounded border border-slate-300 px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-700"
        />
        <button
          onClick={onSavePosition}
          disabled={savingPos}
          className="rounded bg-slate-100 px-2 py-1 text-xs hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          {savingPos ? "Đang lưu..." : "Lưu vị trí"}
        </button>
        {posSaved && <span className="text-xs text-emerald-600">✓ Đã lưu</span>}
      </div>
    </div>
  );
}

export function LessonNotes({ lessonId }: { lessonId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [timestamp, setTimestamp] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch(`/api/lessons/${lessonId}/notes`);
    if (res.ok) {
      const data = await res.json();
      setNotes(data.items);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    const ts = timestamp.trim() === "" ? null : Number(timestamp);
    const res = await fetch(`/api/lessons/${lessonId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, timestampSec: ts }),
    });
    if (res.ok) {
      setBody("");
      setTimestamp("");
      await load();
    }
    setSubmitting(false);
  }

  async function onDelete(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">Ghi chú của tôi</h2>
      <form onSubmit={onSubmit} className="mt-3 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Viết ghi chú..."
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            placeholder="Timestamp (s)"
            className="w-32 rounded border border-slate-300 px-2 py-1 text-sm dark:bg-slate-900 dark:border-slate-700"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="rounded bg-slate-900 px-3 py-1 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            Lưu ghi chú
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Chưa có ghi chú nào.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-3 rounded border border-slate-200 p-3 dark:border-slate-800"
            >
              <div>
                {n.timestampSec !== null && (
                  <span className="mr-2 rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-800">
                    {n.timestampSec}s
                  </span>
                )}
                <span className="text-sm">{n.body}</span>
              </div>
              <button
                onClick={() => onDelete(n.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Xóa
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
