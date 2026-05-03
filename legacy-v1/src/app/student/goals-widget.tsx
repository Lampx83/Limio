"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface GoalRow {
  id: number;
  title: string;
  target_date: string | null;
  strategy: string | null;
  status: "active" | "completed" | "abandoned";
  created_at: string;
  completed_at: string | null;
}

export default function GoalsWidget({ goals }: { goals: GoalRow[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [strategy, setStrategy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          target_date: targetDate || null,
          strategy: strategy || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Lưu thất bại");
        return;
      }
      setTitle("");
      setTargetDate("");
      setStrategy("");
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function complete(id: number) {
    await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
    router.refresh();
  }

  async function remove(id: number) {
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const active = goals.filter((g) => g.status === "active");
  const done = goals.filter((g) => g.status === "completed");

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-semibold text-base">🎯 Mục tiêu học tập</h3>
          <p className="text-xs text-slate-500">
            Tự đặt mục tiêu - rèn năng lực tự định hướng
          </p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn-primary text-xs py-1.5 px-3">
            + Đặt mục tiêu
          </button>
        )}
      </div>

      {open && (
        <form onSubmit={add} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 mb-3 space-y-2">
          <input
            className="input text-sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Hiểu được mô hình SAMR và áp dụng được vào 1 hoạt động thực tế"
            required
            minLength={3}
          />
          <div className="grid sm:grid-cols-2 gap-2">
            <input
              type="date"
              className="input text-sm"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
            <input
              className="input text-sm"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
              placeholder="Chiến lược: VD đọc 1 tài liệu/ngày"
            />
          </div>
          {error && <div className="text-xs text-rose-600">{error}</div>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-xs py-1 px-2">
              Huỷ
            </button>
            <button disabled={submitting} className="btn-primary text-xs py-1 px-2">
              {submitting ? "..." : "Lưu"}
            </button>
          </div>
        </form>
      )}

      {active.length === 0 && done.length === 0 && (
        <p className="text-sm text-slate-500 italic">
          Bạn chưa đặt mục tiêu nào. Đặt mục tiêu cụ thể giúp bạn học hiệu quả hơn.
        </p>
      )}

      {active.length > 0 && (
        <ul className="space-y-2">
          {active.map((g) => (
            <li
              key={g.id}
              className="flex items-start gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/50"
            >
              <button
                onClick={() => complete(g.id)}
                className="mt-0.5 w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 shrink-0"
                title="Đánh dấu hoàn thành"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{g.title}</p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500 mt-0.5">
                  {g.target_date && <span>📅 {g.target_date}</span>}
                  {g.strategy && <span>🛠 {g.strategy}</span>}
                </div>
              </div>
              <button
                onClick={() => remove(g.id)}
                className="text-slate-400 hover:text-rose-500 text-xs shrink-0"
                title="Xoá"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-slate-500">
            ✓ Đã hoàn thành ({done.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {done.map((g) => (
              <li key={g.id} className="line-through">{g.title}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
