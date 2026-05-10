"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import {
  GENERATIVE_PRESETS,
  GENERATIVE_TYPE_OPTIONS,
  type GenerativeActivityType,
} from "@/lib/generativeActivity";

interface Assignment {
  id: string;
  title: string;
  description: string;
  dueAt: Date | null;
  maxScore: number;
  isHidden: boolean;
  pedagogicalIntent?: GenerativeActivityType | null;
  requireSelfRating?: boolean;
  requireReflection?: boolean;
  countsTowardGrade?: boolean;
}

export default function AssignmentSection({
  assignment,
}: {
  assignment: Assignment;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(assignment.title);
  const [description, setDescription] = useState(assignment.description);
  const [dueAt, setDueAt] = useState(
    assignment.dueAt
      ? new Date(assignment.dueAt).toISOString().slice(0, 16)
      : "",
  );
  const [maxScore, setMaxScore] = useState(String(assignment.maxScore));
  const [isHidden, setIsHidden] = useState(assignment.isHidden);
  const [pedagogicalIntent, setPedagogicalIntent] = useState<
    GenerativeActivityType | ""
  >(assignment.pedagogicalIntent ?? "");
  const [requireSelfRating, setRequireSelfRating] = useState(
    assignment.requireSelfRating ?? false,
  );
  const [requireReflection, setRequireReflection] = useState(
    assignment.requireReflection ?? false,
  );
  const [countsTowardGrade, setCountsTowardGrade] = useState(
    assignment.countsTowardGrade ?? true,
  );
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload: Record<string, unknown> = {
      title,
      description,
      maxScore: Number(maxScore) || 100,
      pedagogicalIntent: pedagogicalIntent || null,
      requireSelfRating,
      requireReflection,
      countsTowardGrade,
    };
    if (pedagogicalIntent) {
      payload.responseFormat =
        GENERATIVE_PRESETS[pedagogicalIntent].responseFormat;
    }
    if (dueAt) payload.dueAt = new Date(dueAt).toISOString();
    const res = await fetch(apiUrl(`/api/assignments/${assignment.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function toggleHidden() {
    const next = !isHidden;
    setIsHidden(next);
    await fetch(apiUrl(`/api/assignments/${assignment.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHidden: next }),
    });
    router.refresh();
  }

  async function remove() {
    if (!confirm("Xóa assignment này?")) return;
    setBusy(true);
    const res = await fetch(apiUrl(`/api/assignments/${assignment.id}`), {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <div className={`group/as rounded-xl border-2 p-4 transition-colors ${
      isHidden
        ? 'border-danger-200 bg-danger-50/50'
        : 'border-token bg-[rgb(var(--surface))]'
    }`}>
      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-semibold">{assignment.title}</p>
                {assignment.pedagogicalIntent && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-700">
                    {GENERATIVE_PRESETS[assignment.pedagogicalIntent].label}
                  </span>
                )}
                {isHidden && <span className="chip-danger text-xs">👁️ Ẩn</span>}
              </div>
              {assignment.description && (
                <p className="mt-2 text-sm text-muted">{assignment.description}</p>
              )}
            </div>
            <span className="shrink-0 text-right text-sm text-muted">
              <div className="font-semibold text-base">{assignment.maxScore}đ</div>
              {assignment.dueAt && (
                <div className="text-xs text-faint mt-1">
                  {new Date(assignment.dueAt).toLocaleString("vi-VN")}
                </div>
              )}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/instructor/assignments/${assignment.id}/submissions`}
              className="btn-secondary btn-sm"
            >
              Xem bài nộp
            </Link>
            <div className="ml-auto flex items-center gap-1 rounded-lg border border-token bg-surface-2/50 p-0.5 opacity-60 transition-opacity group-hover/as:opacity-100">
              <button
                type="button"
                onClick={toggleHidden}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                  isHidden
                    ? "bg-danger-50 text-danger-600 hover:bg-danger-100"
                    : "text-faint hover:bg-brand-soft hover:text-brand-600"
                }`}
                title={isHidden ? "Đang ẩn — bấm để hiện" : "Đang hiện — bấm để ẩn"}
                aria-label={isHidden ? "Hiện assignment" : "Ẩn assignment"}
                aria-pressed={isHidden}
              >
                {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-brand-soft hover:text-brand-600"
                title="Sửa assignment"
                aria-label="Sửa"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                title="Xóa assignment"
                aria-label="Xóa"
                className="flex h-8 w-8 items-center justify-center rounded-md text-faint transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      ) : (
        <form onSubmit={save} className="space-y-2">
          <label className="block">
            <span className="text-xs text-faint">Loại hoạt động (tuỳ chọn)</span>
            <select
              value={pedagogicalIntent}
              onChange={(e) =>
                setPedagogicalIntent(
                  e.target.value as GenerativeActivityType | "",
                )
              }
              className="input mt-1"
            >
              <option value="">Bài tập thường</option>
              {GENERATIVE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} disabled={!o.available}>
                  {o.label}
                  {!o.available ? " (sắp có)" : ""}
                </option>
              ))}
            </select>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="input"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={3}
            className="textarea"
          />
          <fieldset className="grid grid-cols-1 gap-1 rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-2 text-xs sm:grid-cols-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requireSelfRating}
                onChange={(e) => setRequireSelfRating(e.target.checked)}
              />
              Yêu cầu tự đánh giá
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requireReflection}
                onChange={(e) => setRequireReflection(e.target.checked)}
              />
              Yêu cầu reflection
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={countsTowardGrade}
                onChange={(e) => setCountsTowardGrade(e.target.checked)}
              />
              Tính vào điểm
            </label>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="input flex-1"
            />
            <input
              type="number"
              min={1}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              className="input w-24"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary btn-sm">
              Lưu
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-secondary btn-sm"
            >
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
