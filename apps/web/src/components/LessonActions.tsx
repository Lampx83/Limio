"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { useT } from "@/lib/i18n/client";

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

  useEffect(() => {
    fetch(apiUrl(`/api/lessons/${lessonId}/view`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionSec: initialResumeSec }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function onComplete() {
    setCompleting(true);
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}/complete`), { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setCompleted(true);
      if (data.courseCompleted) {
        window.location.href = `/learn/${courseSlug}`;
      }
    }
    setCompleting(false);
  }

  async function onSavePosition() {
    setSavingPos(true);
    setPosSaved(false);
    await fetch(apiUrl(`/api/lessons/${lessonId}/view`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionSec: position }),
    });
    setSavingPos(false);
    setPosSaved(true);
    setTimeout(() => setPosSaved(false), 2000);
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-card ${
        completed
          ? "border-success-100 bg-gradient-to-br from-success-50 to-transparent"
          : "border-token bg-[rgb(var(--surface))]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p
            className={`text-base font-semibold ${
              completed ? "text-success-700" : "text-[rgb(var(--text))]"
            }`}
          >
            {completed ? "✓ Đã hoàn thành bài này" : "Chưa hoàn thành"}
          </p>
          {!completed && (
            <p className="mt-1 text-xs text-muted">
              Click nút bên phải khi bạn đã hiểu nội dung.
            </p>
          )}
        </div>
        {!completed && (
          <button
            onClick={onComplete}
            disabled={completing}
            className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg bg-success-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-success-700 hover:shadow-md disabled:opacity-50"
          >
            {completing ? "Đang lưu..." : "✓ Đánh dấu hoàn thành"}
          </button>
        )}
        {completed && nextLessonId && (
          <a
            href={`/learn/${courseSlug}/lessons/${nextLessonId}`}
            className="btn-primary"
          >
            Bài tiếp theo →
          </a>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-token bg-[rgb(var(--surface-muted))/0.5] px-5 py-3">
        <label className="text-xs font-medium text-faint" htmlFor={`pos-${lessonId}`}>
          Vị trí xem (giây)
        </label>
        <input
          id={`pos-${lessonId}`}
          type="number"
          min={0}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          className="input w-24 text-xs"
        />
        <button
          onClick={onSavePosition}
          disabled={savingPos}
          className="btn-ghost btn-sm"
        >
          {savingPos ? "Đang lưu..." : "Lưu vị trí"}
        </button>
        {posSaved && (
          <span className="text-xs font-medium text-success-600">✓ Đã lưu</span>
        )}
      </div>
    </div>
  );
}

export function LessonNotes({
  lessonId,
  hideHeading = false,
  onCount,
}: {
  lessonId: string;
  hideHeading?: boolean;
  /** Báo số ghi chú mỗi khi danh sách đổi (panel phải hiện "Ghi chú · n"). */
  onCount?: (n: number) => void;
}) {
  const t = useT();
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [timestamp, setTimestamp] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}/notes`));
    if (res.ok) {
      const data = await res.json();
      setNotes(data.items);
      onCount?.((data.items as unknown[]).length);
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
    const res = await fetch(apiUrl(`/api/lessons/${lessonId}/notes`), {
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
    const res = await fetch(apiUrl(`/api/notes/${id}`), { method: "DELETE" });
    if (res.ok) await load();
  }

  return (
    <section>
      {!hideHeading && (
        <h2 className="text-xl font-semibold">{t("ai.notes.heading")}</h2>
      )}
      <form
        onSubmit={onSubmit}
        className={`space-y-2 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-2.5 ${hideHeading ? "" : "mt-4"}`}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder={t("ai.notes.placeholder")}
          className="textarea"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={timestamp}
            onChange={(e) => setTimestamp(e.target.value)}
            placeholder={t("ai.notes.secPlaceholder")}
            title={t("ai.notes.secTitle")}
            aria-label={t("ai.notes.secAria")}
            className="input w-20 text-sm"
          />
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="btn-primary btn-sm ml-auto"
          >
            {t("ai.notes.save")}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-token px-3 py-3 text-center text-sm text-faint">
          {t("ai.notes.empty")}
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] p-2.5"
            >
              <div className="min-w-0 flex-1">
                {n.timestampSec !== null && (
                  <span className="chip mr-2 font-mono">
                    {n.timestampSec}s
                  </span>
                )}
                <span className="text-sm">{n.body}</span>
              </div>
              <button
                onClick={() => onDelete(n.id)}
                className="text-xs font-medium text-danger-600 hover:underline"
              >
                {t("ai.notes.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
