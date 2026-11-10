"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { LIMITS, errorText, type ScenarioRow } from "./types";
import type { PanelProps } from "./VanDapEditor";

/**
 * Kịch bản = HỎI TRONG BỐI CẢNH NÀO. Mọi kịch bản dùng chung một dàn câu hỏi; kịch bản chỉ đổi bối cảnh.
 * Mỗi học viên được giao một kịch bản (chia đều). Không có kịch bản nào = cả lớp hỏi cùng một bối cảnh chung.
 */
export default function ScenariosPanel({ data, reload, say }: PanelProps) {
  const draft = data.exam.status === "draft";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [studentBrief, setStudentBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const atLimit = data.scenarios.length >= LIMITS.maxScenarios;

  function reset() {
    setEditingId(null);
    setTitle("");
    setAiContext("");
    setStudentBrief("");
  }

  function edit(s: ScenarioRow) {
    setEditingId(s.id);
    setTitle(s.title);
    setAiContext(s.aiContext);
    setStudentBrief(s.studentBrief ?? "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const base = apiUrl(`/api/van-dap/exams/${data.exam.id}/scenarios`);
      const res = await fetch(editingId ? `${base}/${editingId}` : base, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, aiContext, studentBrief }),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return say("error", errorText(out.error));
      reset();
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: ScenarioRow) {
    if (!window.confirm(`Xoá kịch bản "${s.title}"?`)) return;
    const res = await fetch(apiUrl(`/api/van-dap/exams/${data.exam.id}/scenarios/${s.id}`), { method: "DELETE" });
    if (!res.ok) {
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      return say("error", errorText(out.error));
    }
    if (editingId === s.id) reset();
    await reload();
  }

  return (
    <section aria-labelledby="vd-scn" className="card space-y-3">
      <div>
        <h2 id="vd-scn" className="text-h3">
          Kịch bản
        </h2>
        <p className="mt-1 text-sm text-faint">
          Kịch bản chỉ đổi bối cảnh hỏi, không có dàn riêng: mọi học viên vẫn được hỏi cùng các ý ở trên. Tối đa {LIMITS.maxScenarios} kịch bản.
        </p>
      </div>

      {data.scenarios.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có kịch bản: cả lớp được hỏi trong một bối cảnh chung.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-default">
          {data.scenarios.map((s) => (
            <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium">{s.title}</p>
                <p className="line-clamp-2 break-words text-xs text-slate-500">{s.aiContext}</p>
              </div>
              {draft && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => edit(s)} className="btn btn-secondary btn-sm">
                    Sửa
                  </button>
                  <button type="button" onClick={() => remove(s)} className="btn btn-secondary btn-sm">
                    Xoá
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <form onSubmit={submit} className="space-y-3 rounded-lg border border-default bg-slate-50 p-3">
          <p className="text-sm font-medium">{editingId ? "Sửa kịch bản" : "Thêm kịch bản"}</p>
          <div>
            <label htmlFor="vd-scn-title" className="block text-caption font-medium">
              Tiêu đề kịch bản
            </label>
            <input id="vd-scn-title" className="input mt-1 w-full" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label htmlFor="vd-scn-ctx" className="block text-caption font-medium">
              Bối cảnh cho AI (học viên không đọc trực tiếp)
            </label>
            <textarea id="vd-scn-ctx" rows={3} className="textarea mt-1 w-full" value={aiContext} maxLength={LIMITS.scenarioAiContextMax} onChange={(e) => setAiContext(e.target.value)} />
          </div>
          <div>
            <label htmlFor="vd-scn-brief" className="block text-caption font-medium">
              Thẻ &quot;Tình huống của bạn&quot; — phần học viên được đọc (tuỳ chọn)
            </label>
            <textarea id="vd-scn-brief" rows={3} className="textarea mt-1 w-full" value={studentBrief} maxLength={LIMITS.scenarioStudentBriefMax} onChange={(e) => setStudentBrief(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy || (atLimit && !editingId) || !title.trim() || !aiContext.trim()} className="btn btn-secondary btn-sm disabled:opacity-50">
              {busy ? "Đang lưu…" : editingId ? "Lưu kịch bản" : "Thêm kịch bản"}
            </button>
            {editingId && (
              <button type="button" onClick={reset} className="btn btn-secondary btn-sm">
                Huỷ
              </button>
            )}
            {atLimit && !editingId && <span className="text-caption text-faint">Đã đủ {LIMITS.maxScenarios} kịch bản.</span>}
          </div>
        </form>
      )}
    </section>
  );
}
