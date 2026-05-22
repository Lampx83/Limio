"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

type RubricCriterion = {
  id: string;
  label: string;
  scale: "1-5" | "pass_fail";
  weight: number;
};

export default function ReviewForm({
  reviewAssignmentId,
  rubric,
}: {
  reviewAssignmentId: string;
  rubric: RubricCriterion[];
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(rubric.map((c) => [c.id, c.scale === "1-5" ? 3 : 1])),
  );
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (rubric.length === 0) {
    return <p className="text-sm text-danger-600">Rubric chưa được cấu hình.</p>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      scores: rubric.map((c) => ({ criterionId: c.id, score: scores[c.id] ?? 0 })),
      comment: comment.trim() || undefined,
    };
    const res = await fetch(apiUrl(`/api/mission-reviews/${reviewAssignmentId}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "submit_failed");
    } else {
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-5">
        <h2 className="text-sm font-semibold">Chấm theo rubric</h2>
        <ul className="mt-3 space-y-3">
          {rubric.map((c) => (
            <li key={c.id} className="space-y-1.5">
              <label className="text-sm font-medium">
                {c.label}{" "}
                <span className="text-xs text-faint">
                  ({c.scale === "1-5" ? "1–5" : "Pass/Fail"} · weight {c.weight})
                </span>
              </label>
              {c.scale === "1-5" ? (
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScores((s) => ({ ...s, [c.id]: n }))}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${
                        scores[c.id] === n
                          ? "border-brand-400 bg-brand-soft text-brand-800"
                          : "border-token bg-[rgb(var(--surface))] hover:border-brand-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-1.5">
                  {[
                    { v: 0, t: "Fail" },
                    { v: 1, t: "Pass" },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setScores((s) => ({ ...s, [c.id]: opt.v }))}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium transition-colors ${
                        scores[c.id] === opt.v
                          ? "border-brand-400 bg-brand-soft text-brand-800"
                          : "border-token bg-[rgb(var(--surface))] hover:border-brand-300"
                      }`}
                    >
                      {opt.t}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label className="label text-xs">Nhận xét (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Nhận xét cho người làm bài..."
          className="input mt-1 text-sm"
        />
      </div>

      {error && <p className="text-sm text-danger-600">Lỗi: {error}</p>}

      <button type="submit" disabled={busy} className="btn-primary">
        {busy ? "Đang nộp..." : "Nộp review"}
      </button>
    </form>
  );
}
