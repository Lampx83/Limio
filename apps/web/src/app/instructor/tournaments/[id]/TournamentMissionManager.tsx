"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

interface Mission {
  id: string;
  title: string;
  description: string;
  points: number;
  orderIndex: number;
  prerequisiteId: string | null;
}

export default function TournamentMissionManager({
  tournamentId,
  status,
  missions: initialMissions,
}: {
  tournamentId: string;
  status: string;
  missions: Mission[];
}) {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>(initialMissions);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add-mission form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPoints, setNewPoints] = useState("100");
  const [newPrereqId, setNewPrereqId] = useState("");
  const [busy, setBusy] = useState(false);

  const isDraft = status === "draft";
  const canAdd = status === "draft" || status === "published";

  async function addMission(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      title: newTitle,
      description: newDesc,
      points: parseInt(newPoints, 10) || 100,
    };
    if (newPrereqId) payload.prerequisiteId = newPrereqId;

    const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/missions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setAdding(false);
      setNewTitle("");
      setNewDesc("");
      setNewPoints("100");
      setNewPrereqId("");
      router.refresh();
      // Optimistically re-fetch so list stays in sync
      const freshRes = await fetch(
        `/api/tournaments/${tournamentId}/missions`,
      );
      if (freshRes.ok) {
        const { missions: fresh } = await freshRes.json();
        setMissions(fresh);
      }
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "add_failed");
    }
  }

  async function removeMission(missionId: string) {
    if (!confirm("Xoá mission này?")) return;
    setDeleting(missionId);
    setError(null);
    const res = await fetch(apiUrl(`/api/tournament-missions/${missionId}`, {
      method: "DELETE",
    });
    setDeleting(null);
    if (res.ok) {
      setMissions((prev) => prev.filter((m) => m.id !== missionId));
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "delete_failed");
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Missions</h2>
        <span className="text-sm text-muted">{missions.length} missions</span>
      </div>

      {error && (
        <p className="mt-2 text-sm text-danger-600">Lỗi: {error}</p>
      )}

      {/* Mission list */}
      {missions.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-token p-8 text-center text-sm text-muted">
          Chưa có mission nào. Thêm mission đầu tiên bên dưới.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {missions.map((m) => {
            const prereq = m.prerequisiteId
              ? missions.find((x) => x.id === m.prerequisiteId)
              : null;
            return (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-token bg-[rgb(var(--surface))] px-4 py-3"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-700">
                    {m.orderIndex}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{m.title}</p>
                    {m.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                        {m.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-faint">
                      <span className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5">
                        {m.points} pts
                      </span>
                      {prereq && (
                        <span className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5">
                          Cần: {prereq.title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isDraft && (
                  <button
                    onClick={() => removeMission(m.id)}
                    disabled={deleting === m.id}
                    className="flex-shrink-0 text-xs text-danger-600 hover:text-danger-700 disabled:opacity-50"
                  >
                    {deleting === m.id ? "..." : "Xoá"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Add mission */}
      {canAdd && (
        <div className="mt-4">
          {!adding ? (
            <button
              onClick={() => setAdding(true)}
              className="btn-secondary btn-sm"
            >
              + Thêm mission
            </button>
          ) : (
            <form
              onSubmit={addMission}
              className="card mt-2 space-y-3 border-brand-200"
            >
              <h3 className="text-sm font-semibold">Thêm mission mới</h3>

              <div>
                <label className="label text-xs" htmlFor="nm-title">
                  Tiêu đề
                </label>
                <input
                  id="nm-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="Ví dụ: Hoàn thành 5 quiz"
                  className="input mt-1 text-sm"
                />
              </div>

              <div>
                <label className="label text-xs" htmlFor="nm-desc">
                  Mô tả
                </label>
                <textarea
                  id="nm-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  required
                  rows={3}
                  placeholder="Hướng dẫn cho learner..."
                  className="textarea mt-1 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs" htmlFor="nm-pts">
                    Điểm thưởng
                  </label>
                  <input
                    id="nm-pts"
                    type="number"
                    min={0}
                    value={newPoints}
                    onChange={(e) => setNewPoints(e.target.value)}
                    className="input mt-1 text-sm"
                  />
                </div>
                <div>
                  <label className="label text-xs" htmlFor="nm-prereq">
                    Cần hoàn thành trước (tùy chọn)
                  </label>
                  <select
                    id="nm-prereq"
                    value={newPrereqId}
                    onChange={(e) => setNewPrereqId(e.target.value)}
                    className="select mt-1 text-sm"
                  >
                    <option value="">— Không —</option>
                    {missions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.orderIndex}. {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-token pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setError(null);
                  }}
                  className="btn-ghost btn-sm"
                >
                  Hủy
                </button>
                <button type="submit" disabled={busy} className="btn-primary btn-sm">
                  {busy ? "Đang thêm..." : "Thêm"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
