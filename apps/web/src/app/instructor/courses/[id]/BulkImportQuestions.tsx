"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

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
    const res = await fetch(apiUrl(`/api/quizzes/${quizId}/questions/bulk-import`, {
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
      <button onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        Bulk import CSV
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3 text-xs">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Bulk import questions từ CSV</p>
        <button
          onClick={() => setOpen(false)}
          className="text-faint hover:text-[rgb(var(--text))]"
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>
      <p className="mt-2 text-muted">
        Format: 1 dòng = 1 option. Required columns:{" "}
        <code className="rounded bg-[rgb(var(--surface))] px-1 py-0.5 font-mono">
          prompt,type,option_label,is_correct
        </code>
        . Optional:{" "}
        <code className="rounded bg-[rgb(var(--surface))] px-1 py-0.5 font-mono">
          explanation,points
        </code>
        . Multi-option = lặp prompt qua các dòng.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={pickFile}
          className="text-xs file:mr-2 file:rounded file:border-0 file:bg-brand-soft file:px-2 file:py-1 file:text-brand-700"
        />
        <button onClick={() => setCsv(SAMPLE)} className="btn-ghost btn-sm">
          Insert sample
        </button>
      </div>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={8}
        placeholder="Paste CSV content here..."
        className="textarea mt-2 font-mono text-xs"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={importCsv}
          disabled={busy || !csv.trim()}
          className="btn-primary btn-sm"
        >
          {busy ? "Đang import..." : "Import"}
        </button>
      </div>
      {result && (
        <div className="mt-3 space-y-1">
          <p className="font-medium text-success-700">
            ✓ Đã tạo {result.created}/{result.totalGroups} câu hỏi
          </p>
          {result.errors.length > 0 && (
            <ul className="space-y-0.5 text-danger-600">
              {result.errors.map((e, i) => (
                <li key={i}>
                  ✗ Row {e.index + 1}: &quot;{e.prompt}&quot; — {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
