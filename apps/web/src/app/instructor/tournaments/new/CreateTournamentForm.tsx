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
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <label className="label" htmlFor="t-title">Tiêu đề</label>
        <input
          id="t-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          placeholder="Ví dụ: Đại số sprint tháng 5"
          className="input mt-1.5"
        />
      </div>
      <div>
        <label className="label" htmlFor="t-desc">Mô tả</label>
        <textarea
          id="t-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          placeholder="Mục tiêu, luật chơi, phần thưởng..."
          className="textarea mt-1.5"
        />
      </div>
      <div>
        <label className="label" htmlFor="t-course">Khóa học</label>
        <select
          id="t-course"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="select mt-1.5"
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
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="t-start">Bắt đầu</label>
          <input
            id="t-start"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="input mt-1.5"
          />
        </div>
        <div>
          <label className="label" htmlFor="t-end">Kết thúc</label>
          <input
            id="t-end"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            className="input mt-1.5"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="t-team">Team size</label>
          <input
            id="t-team"
            type="number"
            min={1}
            value={teamSize}
            onChange={(e) => setTeamSize(e.target.value)}
            className="input mt-1.5"
          />
          <span className="help">1 = solo</span>
        </div>
        <div>
          <label className="label" htmlFor="t-prize">Prize XP</label>
          <input
            id="t-prize"
            type="number"
            min={0}
            value={prizeXp}
            onChange={(e) => setPrizeXp(e.target.value)}
            className="input mt-1.5"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-token pt-4">
        {error && (
          <span className="mr-auto text-sm text-danger-600">Lỗi: {error}</span>
        )}
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "..." : "🏆 Tạo nháp"}
        </button>
      </div>
    </form>
  );
}
