"use client";

import { useState } from "react";
import { Download, Upload, X, Check, AlertTriangle, XCircle } from "lucide-react";

/**
 * Shared MCQ import modal — dùng được cho Quiz, Question Bank, Exam.
 * Caller truyền `target` để xác định 2 endpoint preview + commit phù hợp.
 *
 * Flow 3 stage:
 *   upload → preview (bảng row với status icon) → result (số đã tạo + lỗi)
 *
 * Server endpoints expected:
 *   POST `${previewEndpoint}` — multipart form-data field "file" → ParseResult
 *   POST `${commitEndpoint}`  — JSON { rows: ParsedMcqRow[] } → { created, errors }
 *
 * Template download: GET /api/imports/mcq-template (xlsx file).
 */

interface ParsedMcqRow {
  rowNumber: number;
  status: "ok" | "warning" | "error";
  errors: string[];
  warnings: string[];
  parsed?: {
    type: "mcq" | "true_false";
    prompt: string;
    options: Array<{ letter: string; label: string; isCorrect: boolean }>;
    points: number;
    difficulty: number;
    cognitiveLevel: string;
    explanation: string | null;
  };
}

interface ParseResult {
  rows: ParsedMcqRow[];
  summary: { ok: number; warning: number; error: number; total: number };
}

export default function ImportMcqModal({
  open,
  onClose,
  onCommitted,
  previewEndpoint,
  commitEndpoint,
  destinationLabel,
}: {
  open: boolean;
  onClose: () => void;
  onCommitted: () => void;
  /** vd: `/api/quizzes/abc-123/questions/mcq-import-preview` */
  previewEndpoint: string;
  /** vd: `/api/quizzes/abc-123/questions/mcq-import-commit` */
  commitEndpoint: string;
  /** vd: "quiz", "ngân hàng câu hỏi" — dùng cho copy phía UI. */
  destinationLabel: string;
}) {
  const [stage, setStage] = useState<"upload" | "preview" | "result">("upload");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [committed, setCommitted] = useState<{
    created: number;
    errors: Array<{ rowNumber: number; message: string }>;
  } | null>(null);

  if (!open) return null;

  function reset() {
    setStage("upload");
    setBusy(false);
    setErr(null);
    setResult(null);
    setCommitted(null);
  }
  function closeAll() {
    reset();
    onClose();
  }

  async function uploadFile(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch(previewEndpoint, { method: "POST", body: form });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as ParseResult;
      setResult(j);
      setStage("preview");
    } catch {
      setErr("Lỗi mạng — thử lại");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!result) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(commitEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: result.rows }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as {
        created: number;
        errors: Array<{ rowNumber: number; message: string }>;
      };
      setCommitted(j);
      setStage("result");
      onCommitted();
    } catch {
      setErr("Lỗi mạng — thử lại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-default px-5 py-3">
          <h2 className="text-base font-semibold">
            Import câu hỏi MCQ từ Excel
            <span className="ml-2 text-xs font-normal text-faint">
              → {destinationLabel}
            </span>
          </h2>
          <button
            onClick={closeAll}
            className="text-faint hover:text-slate-700"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {stage === "upload" && <UploadStage onPickFile={uploadFile} busy={busy} err={err} />}
          {stage === "preview" && result && (
            <PreviewStage result={result} onBack={reset} onCommit={commit} busy={busy} err={err} />
          )}
          {stage === "result" && committed && (
            <ResultStage committed={committed} onDone={closeAll} />
          )}
        </div>
      </div>
    </div>
  );
}

function UploadStage({
  onPickFile,
  busy,
  err,
}: {
  onPickFile: (f: File) => void;
  busy: boolean;
  err: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
        <p className="font-semibold">Hướng dẫn:</p>
        <ol className="mt-1 list-decimal space-y-0.5 pl-4">
          <li>Tải file template mẫu, mở bằng Excel/Google Sheets.</li>
          <li>
            Điền cột: <code>Prompt</code> (câu hỏi),{" "}
            <code>OptionA…F</code> (đáp án), <code>Correct</code> (chữ cái
            đáp án đúng, vd "A" hoặc "A,C").
          </li>
          <li>
            Cột tuỳ chọn: <code>Type</code>, <code>Points</code>,{" "}
            <code>Difficulty</code>, <code>Explanation</code>,{" "}
            <code>CognitiveLevel</code>.
          </li>
          <li>Tải file lên → xem preview → confirm import.</li>
        </ol>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href="/api/imports/mcq-template"
          className="inline-flex items-center gap-1.5 rounded border border-default bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" /> Tải template mẫu (.xlsx)
        </a>
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-sm transition-colors ${
          busy
            ? "border-default bg-slate-50 text-faint"
            : "border-blue-300 bg-blue-50/30 text-blue-700 hover:bg-blue-50"
        }`}
      >
        <Upload className="h-8 w-8" />
        <span className="font-medium">
          {busy ? "Đang đọc file…" : "Click để chọn file .xlsx"}
        </span>
        <span className="text-xs text-faint">
          Hoặc kéo thả file vào đây (tối đa 500 câu / lần)
        </span>
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
          }}
          className="hidden"
        />
      </label>

      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}
    </div>
  );
}

function PreviewStage({
  result,
  onBack,
  onCommit,
  busy,
  err,
}: {
  result: ParseResult;
  onBack: () => void;
  onCommit: () => void;
  busy: boolean;
  err: string | null;
}) {
  const { summary, rows } = result;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-default bg-slate-50 px-3 py-2 text-xs">
        <span className="font-semibold">Tổng: {summary.total}</span>
        <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
          <Check className="h-3 w-3" /> {summary.ok} OK
        </span>
        {summary.warning > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-amber-800">
            <AlertTriangle className="h-3 w-3" /> {summary.warning} cảnh báo
          </span>
        )}
        {summary.error > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-red-800">
            <XCircle className="h-3 w-3" /> {summary.error} lỗi (bỏ qua)
          </span>
        )}
      </div>

      <div className="max-h-[400px] overflow-y-auto rounded-lg border border-default">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-100 text-left">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Câu hỏi</th>
              <th className="px-2 py-1.5">Loại</th>
              <th className="px-2 py-1.5">Đáp án</th>
              <th className="px-2 py-1.5">Đúng</th>
              <th className="px-2 py-1.5">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.rowNumber}
                className={`border-t border-default ${
                  row.status === "error"
                    ? "bg-red-50/40"
                    : row.status === "warning"
                      ? "bg-amber-50/40"
                      : ""
                }`}
              >
                <td className="px-2 py-1.5 align-top text-faint">{row.rowNumber}</td>
                <td className="px-2 py-1.5 align-top">
                  <div className="line-clamp-2 text-slate-800">
                    {row.parsed?.prompt ?? "(thiếu)"}
                  </div>
                  {(row.errors.length > 0 || row.warnings.length > 0) && (
                    <div className="mt-0.5 space-y-0.5">
                      {row.errors.map((e, i) => (
                        <div key={i} className="text-[10px] text-red-700">
                          ✗ {e}
                        </div>
                      ))}
                      {row.warnings.map((w, i) => (
                        <div key={i} className="text-[10px] text-amber-700">
                          ⚠ {w}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-2 py-1.5 align-top text-faint">
                  {row.parsed?.type ?? "—"}
                </td>
                <td className="px-2 py-1.5 align-top text-faint">
                  {row.parsed?.options.length ?? 0}
                </td>
                <td className="px-2 py-1.5 align-top text-faint">
                  {row.parsed?.options
                    .filter((o) => o.isCorrect)
                    .map((o) => o.letter)
                    .join(", ") ?? "—"}
                </td>
                <td className="px-2 py-1.5 align-top">
                  {row.status === "ok" && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-800">
                      <Check className="h-3 w-3" /> OK
                    </span>
                  )}
                  {row.status === "warning" && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                      <AlertTriangle className="h-3 w-3" /> Cảnh báo
                    </span>
                  )}
                  {row.status === "error" && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-800">
                      <XCircle className="h-3 w-3" /> Lỗi
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {err && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="rounded border border-default bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          ← Chọn file khác
        </button>
        <button
          type="button"
          onClick={onCommit}
          disabled={busy || summary.ok + summary.warning === 0}
          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Đang import..."
            : `Import ${summary.ok + summary.warning} câu (bỏ qua ${summary.error} lỗi)`}
        </button>
      </div>
    </div>
  );
}

function ResultStage({
  committed,
  onDone,
}: {
  committed: { created: number; errors: Array<{ rowNumber: number; message: string }> };
  onDone: () => void;
}) {
  return (
    <div className="space-y-3 text-center">
      <Check className="mx-auto h-12 w-12 text-emerald-500" />
      <h3 className="text-lg font-semibold">Đã import {committed.created} câu hỏi</h3>
      {committed.errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs">
          <p className="font-semibold text-amber-900">
            {committed.errors.length} câu lỗi (không tạo được):
          </p>
          <ul className="mt-1 space-y-0.5">
            {committed.errors.map((e, i) => (
              <li key={i} className="text-amber-800">
                Dòng {e.rowNumber}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={onDone}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Xong
      </button>
    </div>
  );
}
