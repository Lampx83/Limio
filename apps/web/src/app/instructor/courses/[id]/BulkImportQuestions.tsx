"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SAMPLE = `prompt,type,option_label,is_correct,explanation,points
"Phương trình bậc 1 có dạng nào?",mcq,"ax + b = 0",true,"Đáp án chuẩn theo SGK",1
"Phương trình bậc 1 có dạng nào?",mcq,"ax^2 + bx + c = 0",false,,1
"Phương trình bậc 1 có dạng nào?",mcq,"a/b = 0",false,,1
"2 + 2 = 5?",true_false,"Đúng",false,,1
"2 + 2 = 5?",true_false,"Sai",true,,1`;

export default function BulkImportQuestions({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    errors: Array<{ index: number; prompt: string; error: string }>;
    totalGroups: number;
  } | null>(null);

  async function importCsv() {
    setBusy(true);
    setResult(null);
    const res = await fetch(`/api/quizzes/${quizId}/questions/bulk-import`, {
      method: "POST",
      headers: { "Content-Type": "text/csv" },
      body: csv,
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      setResult(d);
      if (d.created > 0) router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(`Import thất bại: ${d.error ?? "unknown"} ${JSON.stringify(d.details ?? "")}`);
    }
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setCsv(text);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
      >
        📥 Bulk import CSV
      </button>
    );
  }

  return (
    <div className="w-full rounded border border-slate-300 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex items-center justify-between">
        <p className="font-medium">📥 Bulk import questions từ CSV</p>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-500 hover:text-slate-800"
        >
          ✕
        </button>
      </div>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Format: 1 dòng = 1 option. Required columns:{" "}
        <code>prompt,type,option_label,is_correct</code>. Optional:{" "}
        <code>explanation,points</code>. Multi-option = lặp prompt qua các dòng.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={pickFile}
          className="text-xs"
        />
        <button
          onClick={() => setCsv(SAMPLE)}
          className="rounded border border-slate-300 px-2 py-0.5 hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Insert sample
        </button>
      </div>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={8}
        placeholder="Paste CSV content here..."
        className="mt-2 w-full rounded border border-slate-300 px-2 py-1 font-mono text-[11px] dark:border-slate-700 dark:bg-slate-900"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={importCsv}
          disabled={busy || !csv.trim()}
          className="rounded bg-slate-900 px-3 py-1 font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? "Đang import..." : "Import"}
        </button>
      </div>
      {result && (
        <div className="mt-3 space-y-1">
          <p className="text-emerald-700 dark:text-emerald-300">
            ✓ Đã tạo {result.created}/{result.totalGroups} câu hỏi
          </p>
          {result.errors.length > 0 && (
            <ul className="space-y-0.5 text-red-700 dark:text-red-300">
              {result.errors.map((e, i) => (
                <li key={i}>
                  ✗ Row {e.index + 1}: "{e.prompt}" — {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
