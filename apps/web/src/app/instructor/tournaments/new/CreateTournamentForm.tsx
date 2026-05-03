"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CreateTournamentForm({
  courses,
  canCreatePlatformWide,
}: {
  courses: Array<{ id: string; title: string }>;
  canCreatePlatformWide: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [teamSize, setTeamSize] = useState("1");
  const [prizeXp, setPrizeXp] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      title,
      description,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
      teamSize: Number(teamSize) || 1,
      prizeXp: Number(prizeXp) || 0,
    };
    if (courseId && courseId !== "PLATFORM") payload.courseId = courseId;

    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/instructor/courses");
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "create_failed");
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3 text-sm">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        maxLength={200}
        placeholder="Tiêu đề tournament"
        className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        required
        rows={4}
        placeholder="Mô tả..."
        className="w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
      />
      <label className="block">
        <span className="text-xs text-slate-500">Khóa học</span>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
        >
          {canCreatePlatformWide && (
            <option value="PLATFORM">— Platform-wide (admin) —</option>
          )}
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="text-xs text-slate-500">Bắt đầu</span>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
        <label>
          <span className="text-xs text-slate-500">Kết thúc</span>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="text-xs text-slate-500">Team size (1=solo)</span>
          <input
            type="number"
            min={1}
            value={teamSize}
            onChange={(e) => setTeamSize(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
        <label>
          <span className="text-xs text-slate-500">Prize XP</span>
          <input
            type="number"
            min={0}
            value={prizeXp}
            onChange={(e) => setPrizeXp(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1 dark:bg-slate-900 dark:border-slate-700"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "..." : "Tạo nháp"}
        </button>
        {error && <span className="text-sm text-red-600">Lỗi: {error}</span>}
      </div>
    </form>
  );
}
