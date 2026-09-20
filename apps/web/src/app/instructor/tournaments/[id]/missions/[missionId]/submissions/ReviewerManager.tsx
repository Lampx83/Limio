"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Plus, X, AlertTriangle } from "lucide-react";
import { tournamentErrorMessage } from "@/lib/tournamentText";

type Assignment = {
  id: string;
  reviewerId: string;
  name: string;
  completedAt: string | null;
};

export default function ReviewerManager({
  tournamentId,
  submissionId,
  assignments,
  pool,
  targetCount,
}: {
  tournamentId: string;
  submissionId: string;
  assignments: Assignment[];
  /** Active participants eligible to review (author already excluded). */
  pool: { userId: string; name: string }[];
  targetCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set(assignments.map((a) => a.reviewerId));
  const available = pool.filter((p) => !assignedIds.has(p.userId));
  const completed = assignments.filter((a) => a.completedAt).length;
  const shortBy = targetCount - assignments.length;

  async function call(method: "POST" | "DELETE", body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/instructor/tournaments/${tournamentId}/reviewers`,
        {
          method,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(tournamentErrorMessage(data));
        return;
      }
      setPicked("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  function onRemove(a: Assignment) {
    if (
      a.completedAt &&
      !window.confirm(
        `${a.name} đã chấm xong bài này. Gỡ sẽ xóa điểm họ đã chấm và không tính vào kết quả. Tiếp tục?`,
      )
    ) {
      return;
    }
    void call("DELETE", { assignmentId: a.id });
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted">
          Review: {completed}/{assignments.length} hoàn thành
        </span>
        {shortBy > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle size={11} />
            Thiếu {shortBy} reviewer
          </span>
        )}
      </div>

      {assignments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-token bg-[rgb(var(--surface-muted))] py-1 pl-2.5 pr-1.5 text-xs"
            >
              {a.completedAt ? (
                <CheckCircle2 size={12} className="text-success-600" />
              ) : (
                <Clock size={12} className="text-amber-600" />
              )}
              <span className="font-medium">{a.name}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(a)}
                aria-label={`Gỡ ${a.name}`}
                title={a.completedAt ? "Đã chấm — gỡ sẽ xóa điểm" : "Gỡ reviewer"}
                className="rounded-full p-0.5 text-faint hover:bg-danger-50 hover:text-danger-600 disabled:opacity-40 dark:hover:bg-danger-950/40"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <select
          value={picked}
          disabled={busy || available.length === 0}
          onChange={(e) => setPicked(e.target.value)}
          className="rounded-lg border border-token bg-[rgb(var(--surface))] px-2 py-1 text-xs disabled:opacity-40"
        >
          <option value="">
            {available.length === 0 ? "Hết người để thêm" : "+ Thêm reviewer…"}
          </option>
          {available.map((p) => (
            <option key={p.userId} value={p.userId}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !picked}
          onClick={() => call("POST", { submissionId, reviewerId: picked })}
          className="btn-secondary btn-sm inline-flex items-center gap-1 disabled:opacity-40"
        >
          <Plus size={12} />
          Thêm
        </button>
      </div>

      {error && <p className="mt-1.5 text-xs text-danger-600">⚠ {error}</p>}
    </div>
  );
}
