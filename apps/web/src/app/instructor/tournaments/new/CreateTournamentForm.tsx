"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/datetime";
import { tournamentErrorMessage } from "@/lib/tournamentText";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

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
  const [allowLateRegistration, setAllowLateRegistration] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      title,
      description,
      startsAt: fromDateTimeInputValue(startsAt),
      endsAt: fromDateTimeInputValue(endsAt),
      teamSize: Number(teamSize) || 1,
      prizeXp: Number(prizeXp) || 0,
      allowLateRegistration,
    };
    if (courseId && courseId !== "PLATFORM") payload.courseId = courseId;

    const res = await fetch(apiUrl("/api/tournaments"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && d.tournamentId) {
      router.push(`/instructor/tournaments/${d.tournamentId}`);
    } else {
      setError(tournamentErrorMessage(d, "Chưa tạo được đấu trường. Vui lòng thử lại."));
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
        <div className="mt-1.5">
          <RichTextEditor
            value={description}
            onChange={setDescription}
            placeholder="Mục tiêu, luật chơi, phần thưởng..."
          />
        </div>
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
      <div>
        <label className="flex items-start gap-2.5 rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3 hover:border-brand-300 cursor-pointer">
          <input
            type="checkbox"
            checked={allowLateRegistration}
            onChange={(e) => setAllowLateRegistration(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <div className="text-sm">
            <span className="font-medium">
              Cho phép đăng ký khi đấu trường đang diễn ra
            </span>
            <p className="mt-0.5 text-xs text-muted">
              Bật → người chơi có thể tham gia bất cứ lúc nào trước khi kết
              thúc. Tắt → khóa danh sách tại thời điểm bắt đầu (team không
              thể đổi thành viên sau start).
            </p>
          </div>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-token pt-4">
        {error && (
          <span className="mr-auto text-sm text-danger-600">{error}</span>
        )}
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "..." : "Tạo nháp"}
        </button>
      </div>
    </form>
  );
}
