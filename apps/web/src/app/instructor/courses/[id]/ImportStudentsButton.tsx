"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

const SAMPLE = `name,email
Nguyễn Văn An,an.nguyen@example.com
Trần Thị Bình,binh.tran@example.com
Lê Minh Cường,cuong.le@example.com`;

interface ParsedRow {
  name: string;
  email: string;
}

interface ImportResult {
  enrolled: number;
  alreadyEnrolled: number;
  created: number;
  errors: Array<{ row: number; email: string; error: string }>;
}

function parseCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"' && !inQuote) { inQuote = true; continue; }
    if (ch === '"' && inQuote) { inQuote = false; continue; }
    if (ch === "," && !inQuote) { result.push(current); current = ""; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .replace(/^﻿/, "") // strip BOM
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Skip header row (first line)
  return lines.slice(1).map((line) => {
    const cols = parseCsvRow(line);
    return { name: (cols[0] ?? "").trim(), email: (cols[1] ?? "").trim() };
  });
}

export default function ImportStudentsButton({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const parsed = csv.trim() ? parseCsv(csv) : [];
  const preview = parsed.slice(0, 5);
  const overflow = parsed.length - preview.length;

  async function doImport() {
    if (!parsed.length || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl(`/api/instructor/courses/${courseId}/enroll-bulk`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: parsed }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Import thất bại: ${data.error ?? "unknown"}`);
        return;
      }
      setResult(data as ImportResult);
      if (data.enrolled > 0) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setCsv(await f.text());
    setResult(null);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        Import học viên
      </button>
    );
  }

  return (
    <div className="w-full rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-4 text-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-semibold">Import danh sách học viên</p>
        <button
          onClick={() => { setOpen(false); setResult(null); setCsv(""); }}
          className="text-faint hover:text-[rgb(var(--text))]"
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>

      {/* Format hint */}
      <p className="mt-2 text-xs text-muted">
        File CSV với 2 cột:{" "}
        <code className="rounded bg-[rgb(var(--surface))] px-1 py-0.5 font-mono">name,email</code>.
        Học viên chưa có tài khoản sẽ được tạo mới (cần đặt mật khẩu lần đầu qua Forgot password).
      </p>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={pickFile}
          className="text-xs file:mr-2 file:rounded file:border-0 file:bg-brand-soft file:px-2 file:py-1 file:text-brand-700"
        />
        <button
          onClick={() => { setCsv(SAMPLE); setResult(null); }}
          className="btn-ghost btn-sm"
        >
          Insert mẫu
        </button>
      </div>

      <textarea
        value={csv}
        onChange={(e) => { setCsv(e.target.value); setResult(null); }}
        rows={7}
        placeholder={"name,email\nNguyễn Văn An,an@example.com"}
        className="textarea mt-3 font-mono text-xs"
      />

      {/* Live preview */}
      {parsed.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-token text-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b border-token bg-[rgb(var(--surface))] text-left">
                <th className="px-3 py-1.5 font-medium text-muted">Tên</th>
                <th className="px-3 py-1.5 font-medium text-muted">Email</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row, i) => (
                <tr key={i} className="border-b border-token last:border-0">
                  <td className="px-3 py-1.5">{row.name || <span className="text-danger-500">trống</span>}</td>
                  <td className="px-3 py-1.5 font-mono">{row.email || <span className="text-danger-500">trống</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {overflow > 0 && (
            <p className="px-3 py-1.5 text-muted">… và {overflow} dòng nữa</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={doImport}
          disabled={busy || parsed.length === 0}
          className="btn-primary btn-sm"
        >
          {busy ? "Đang import…" : `Import ${parsed.length > 0 ? `${parsed.length} học viên` : ""}`}
        </button>
        {parsed.length > 0 && !busy && (
          <span className="text-xs text-muted">{parsed.length} dòng đã parse</span>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="mt-4 space-y-2 rounded-lg border border-token bg-[rgb(var(--surface))] p-3 text-xs">
          <div className="flex flex-wrap gap-4">
            <span className="font-medium text-success-700">
              ✓ {result.enrolled} mới enroll
            </span>
            {result.created > 0 && (
              <span className="font-medium text-brand-700">
                + {result.created} tài khoản mới tạo
              </span>
            )}
            {result.alreadyEnrolled > 0 && (
              <span className="text-muted">
                {result.alreadyEnrolled} đã enroll trước
              </span>
            )}
          </div>
          {result.errors.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-danger-600">
              {result.errors.map((e, i) => (
                <li key={i}>
                  ✗ Dòng {e.row} ({e.email}): {e.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
