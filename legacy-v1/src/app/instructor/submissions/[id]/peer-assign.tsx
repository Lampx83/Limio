"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Candidate {
  id: number;
  full_name: string;
  username: string;
}
interface Existing {
  id: number;
  status: string;
  full_name: string;
  username: string;
}

export default function PeerAssign({
  submissionId,
  candidates,
  existing,
}: {
  submissionId: number;
  candidates: Candidate[];
  existing: Existing[];
}) {
  const router = useRouter();
  const assignedSet = new Set(existing.map((e) => e.full_name));
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function assign() {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/instructor/submissions/${submissionId}/peer-assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reviewer_ids: selected }),
        },
      );
      if (res.ok) {
        setSelected([]);
        setOpen(false);
        router.refresh();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card p-3 sm:p-4 mt-3">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-sm">💬 Peer Review</h3>
          <p className="text-xs text-slate-500">
            Giao SV khác trong khoá nhận xét bài này
          </p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn-secondary text-xs">
            + Giao peer review
          </button>
        )}
      </div>

      {existing.length > 0 && (
        <ul className="space-y-1 mb-2">
          {existing.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between text-sm py-1 px-2 rounded bg-slate-50 dark:bg-slate-800/50"
            >
              <span>
                {e.full_name}{" "}
                <span className="font-mono text-xs text-slate-400">@{e.username}</span>
              </span>
              {e.status === "submitted" ? (
                <span className="badge-green text-xs">✓ Đã nộp</span>
              ) : (
                <span className="badge-amber text-xs">Chờ làm</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="border border-slate-200 dark:border-slate-700 rounded p-3">
          <p className="text-xs text-slate-500 mb-2">Chọn SV để giao peer review:</p>
          <ul className="space-y-1 max-h-48 overflow-y-auto mb-2">
            {candidates
              .filter((c) => !assignedSet.has(c.full_name))
              .map((c) => (
                <li key={c.id}>
                  <label className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      onChange={() => toggle(c.id)}
                    />
                    {c.full_name}{" "}
                    <span className="font-mono text-xs text-slate-400">@{c.username}</span>
                  </label>
                </li>
              ))}
          </ul>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setOpen(false)}
              className="btn-secondary text-xs py-1 px-2"
            >
              Huỷ
            </button>
            <button
              onClick={assign}
              disabled={submitting || selected.length === 0}
              className="btn-primary text-xs py-1 px-2"
            >
              {submitting ? "..." : `Giao (${selected.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
