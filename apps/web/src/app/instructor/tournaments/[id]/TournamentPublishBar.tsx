"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TournamentPublishBar({
  tournamentId,
  status,
  registrationCount,
  missionCount,
}: {
  tournamentId: string;
  status: string;
  registrationCount: number;
  missionCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "published" }),
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "publish_failed");
    }
  }

  async function endEarly() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tournaments/${tournamentId}/end`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    setBusy(false);
    if (res.ok) {
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "end_failed");
    }
  }

  if (status === "draft") {
    const blocked = missionCount === 0;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-token bg-[rgb(var(--surface-muted))] px-5 py-4">
        <div>
          <p className="text-sm font-medium">Tournament chưa publish</p>
          <p className="mt-0.5 text-xs text-muted">
            Publish để cho phép learner đăng ký. Cron tự flip sang active khi
            đến giờ bắt đầu.
          </p>
          {blocked && (
            <p className="mt-1 text-xs text-accent-700">
              Cần có ít nhất 1 mission trước khi publish.
            </p>
          )}
          {error && (
            <p className="mt-1 text-xs text-danger-600">Lỗi: {error}</p>
          )}
        </div>
        <button
          onClick={publish}
          disabled={busy || blocked}
          className="btn-sm inline-flex items-center justify-center rounded-lg bg-success-600 px-4 py-2 font-medium text-white transition-all hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Đang publish..." : "Publish"}
        </button>
      </div>
    );
  }

  if (status === "published") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent-200 bg-accent-50 px-5 py-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-accent-800">
            Đã publish — đang chờ bắt đầu
          </p>
          <p className="mt-0.5 text-xs text-accent-700">
            Cron sẽ tự động flip sang active khi đến giờ bắt đầu.
            {registrationCount > 0 && (
              <> {registrationCount} người đã đăng ký.</>
            )}
          </p>
          {error && (
            <p className="mt-1 text-xs text-danger-600">Lỗi: {error}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={endEarly}
            disabled={busy}
            className="btn-sm inline-flex items-center justify-center rounded-lg bg-warning-600 px-4 py-2 font-medium text-white transition-all hover:bg-warning-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Hủy tournament trước khi bắt đầu"
          >
            {busy ? "Đang hủy..." : "Hủy tournament"}
          </button>
          <span className="chip-accent">Chờ bắt đầu</span>
        </div>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success-200 bg-success-50 px-5 py-4">
        <div className="flex-1">
          <p className="text-sm font-medium text-success-800">Đang diễn ra</p>
          <p className="mt-0.5 text-xs text-success-700">
            Tournament đang hoạt động. Không thể hoàn tác.
            {registrationCount > 0 && (
              <> {registrationCount} người tham gia.</>
            )}
          </p>
          {error && (
            <p className="mt-1 text-xs text-danger-600">Lỗi: {error}</p>
          )}
        </div>
        <button
          onClick={endEarly}
          disabled={busy}
          className="btn-sm inline-flex items-center justify-center rounded-lg bg-danger-600 px-4 py-2 font-medium text-white transition-all hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-50"
          title="Kết thúc tournament sớm trước deadline"
        >
          {busy ? "Đang kết thúc..." : "Kết thúc sớm"}
        </button>
      </div>
    );
  }

  if (status === "ended") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-token bg-[rgb(var(--surface-muted))] px-5 py-4">
        <div>
          <p className="text-sm font-medium">Tournament đã kết thúc</p>
          <p className="mt-0.5 text-xs text-muted">
            {registrationCount} người tham gia · {missionCount} missions.
            Giải thưởng đã được phân phối tự động.
          </p>
        </div>
        <span className="chip">Đã kết thúc</span>
      </div>
    );
  }

  return null;
}
