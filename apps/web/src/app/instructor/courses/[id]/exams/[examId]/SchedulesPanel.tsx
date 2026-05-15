"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

type Schedule = {
  id: string;
  cohortId: string | null;
  cohortName: string | null;
  opensAt: string;
  closesAt: string;
  durationOverrideMin: number | null;
  ipAllowlistCount: number;
};

type Cohort = { id: string; name: string };

export default function SchedulesPanel({
  examId,
  courseId,
}: {
  examId: string;
  courseId: string;
}) {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setErr(null);
    const [sRes, cRes] = await Promise.all([
      fetch(`/api/exams/${examId}/sessions`),
      fetch(`/api/courses/${courseId}/cohorts`),
    ]);
    if (sRes.ok) setSchedules(((await sRes.json()) as { sessions: Schedule[] }).sessions);
    if (cRes.ok) setCohorts(((await cRes.json()) as { cohorts: Cohort[] }).cohorts);
  };

  useEffect(() => {
    refresh();
  }, [examId, courseId]);

  const onDelete = async (id: string) => {
    if (!window.confirm("Xoá ca thi này?")) return;
    const r = await fetch(`/api/exam-sessions/${id}`, { method: "DELETE" });
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    await refresh();
  };

  return (
    <section
      data-testid="schedules-panel"
      className="mt-8 rounded border border-default bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-semibold"><Calendar className="h-4 w-4 shrink-0 text-slate-400" /> Lịch thi (cohort)</h2>
          <p className="text-sm text-faint">
            Mở ca thi cho lớp cụ thể. Không có lịch → ai enroll đều thi được theo `Exam.openAt/closeAt`.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((s) => !s)}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showAdd ? "Đóng" : "+ Thêm lịch"}
        </button>
      </div>

      {showAdd && (
        <AddScheduleForm
          examId={examId}
          cohorts={cohorts}
          onDone={async () => {
            setShowAdd(false);
            await refresh();
          }}
          setBusy={setBusy}
        />
      )}

      {err && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-default text-left text-xs uppercase text-faint">
              <th className="px-2 py-2">Cohort</th>
              <th className="px-2 py-2">Mở</th>
              <th className="px-2 py-2">Đóng</th>
              <th className="px-2 py-2">Override</th>
              <th className="px-2 py-2 text-center">IP allow</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {schedules === null && (
              <tr><td colSpan={6} className="px-2 py-6 text-center text-faint">Đang tải...</td></tr>
            )}
            {schedules && schedules.length === 0 && (
              <tr><td colSpan={6} className="px-2 py-6 text-center text-faint">Chưa có lịch.</td></tr>
            )}
            {schedules?.map((s) => (
              <tr key={s.id} className="border-b border-default">
                <td className="px-2 py-2">
                  {s.cohortName ? (
                    <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">
                      {s.cohortName}
                    </span>
                  ) : (
                    <span className="text-xs text-faint">Toàn course</span>
                  )}
                </td>
                <td className="px-2 py-2 font-mono text-xs">{fmt(s.opensAt)}</td>
                <td className="px-2 py-2 font-mono text-xs">{fmt(s.closesAt)}</td>
                <td className="px-2 py-2 text-xs">
                  {s.durationOverrideMin ? `${s.durationOverrideMin}p` : <span className="text-faint">—</span>}
                </td>
                <td className="px-2 py-2 text-center text-xs">
                  {s.ipAllowlistCount > 0 ? `${s.ipAllowlistCount} IP` : <span className="text-faint">—</span>}
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    onClick={() => onDelete(s.id)}
                    className="rounded border border-red-300 bg-red-50 px-2 py-0.5 text-xs text-red-800 hover:bg-red-100"
                  >
                    Xoá
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AddScheduleForm({
  examId,
  cohorts,
  onDone,
  setBusy,
}: {
  examId: string;
  cohorts: Cohort[];
  onDone: () => Promise<void>;
  setBusy: (b: boolean) => void;
}) {
  const now = new Date();
  const inHour = new Date(now.getTime() + 60 * 60_000);
  const fmt2 = (d: Date) => {
    const tz = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16);
  };
  const [cohortId, setCohortId] = useState<string>("");
  const [opensAt, setOpensAt] = useState(fmt2(now));
  const [closesAt, setClosesAt] = useState(fmt2(inHour));
  const [override, setOverride] = useState("");
  const [ipList, setIpList] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/exams/${examId}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cohortId: cohortId || null,
          opensAt: new Date(opensAt).toISOString(),
          closesAt: new Date(closesAt).toISOString(),
          durationOverrideMin: override.trim() ? Number(override) : undefined,
          ipAllowlist: ipList
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      await onDone();
    } finally {
      setSubmitting(false);
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      data-testid="add-schedule-form"
      className="mt-3 rounded border border-default bg-slate-50 p-3"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label>
          <span className="block text-xs font-medium text-slate-600">Cohort</span>
          <select
            value={cohortId}
            onChange={(e) => setCohortId(e.target.value)}
            className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
          >
            <option value="">Toàn course (không gating cohort)</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="block text-xs font-medium text-slate-600">Override duration (phút)</span>
          <input
            type="number"
            min={1}
            max={1440}
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder="Để trống = dùng Exam.durationMin"
            className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-slate-600">Mở từ</span>
          <input
            type="datetime-local"
            required
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
            className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
          />
        </label>
        <label>
          <span className="block text-xs font-medium text-slate-600">Đóng lúc</span>
          <input
            type="datetime-local"
            required
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="mt-3 block">
        <span className="block text-xs font-medium text-slate-600">
          IP/CIDR allowlist (cho phòng lab — bypass rate-limit, cách nhau bằng dấu phẩy)
        </span>
        <input
          type="text"
          value={ipList}
          onChange={(e) => setIpList(e.target.value)}
          placeholder="Vd: 192.168.1.0/24, 10.0.0.5"
          className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
        />
      </label>
      {err && (
        <div className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "..." : "Tạo lịch"}
        </button>
      </div>
    </form>
  );
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
