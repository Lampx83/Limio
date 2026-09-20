"use client";

import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { questionSheetToCsv } from "@/lib/questionSheet";

export default function BulkImportQuestions({
  quizId,
  open: openProp,
  onOpenChange,
  pressed,
}: {
  quizId: string;
  /** Điều khiển từ ngoài (trang soạn quiz đặt panel vào vùng giữa); bỏ trống = tự quản lý. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Ép trạng thái "đang chọn" của nút (khi panel hiện ở chỗ khác); bỏ trống = theo open. */
  pressed?: boolean;
}) {
  const router = useRouter();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<{
    created: number;
    errors: Array<{ index: number; prompt: string; error: string }>;
    totalGroups: number;
  } | null>(null);

  async function importCsv() {
    setBusy(true);
    setResult(null);
    const res = await fetch(apiUrl(`/api/quizzes/${quizId}/questions/bulk-import`), {
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
      alert(`Nhập câu hỏi thất bại: ${describeFailure(d.error, d.details)}`);
    }
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setCsv(/\.xlsx?$/i.test(f.name) ? await questionSheetToCsv(f) : await f.text());
    } catch {
      alert("Không đọc được file này. Hãy dùng file mẫu .xlsx hoặc file .csv.");
      return;
    }
    setFileName(f.name);
    setResult(null);
  }

  const isPressed = pressed ?? open;
  const toggle = (
    <button
      type="button"
      onClick={() => setOpen(!isPressed)}
      aria-pressed={isPressed}
      className={`${isPressed ? "btn-primary" : "btn-secondary"} btn-sm inline-flex items-center gap-1.5`}
    >
      <FileSpreadsheet className={`h-4 w-4 ${isPressed ? "text-white" : "text-brand-600"}`} aria-hidden />
      Nhập câu hỏi từ Excel
    </button>
  );

  if (!open) return toggle;

  return (
    <>
      {openProp === undefined && toggle}
    <div className="order-last w-full text-sm">
      <div className="flex items-center justify-between">
        <p className="text-base font-semibold">Nhập nhiều câu hỏi từ file Excel</p>
        <button
          onClick={() => setOpen(false)}
          className="text-faint hover:text-[rgb(var(--text))]"
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>

      <ol className="mt-3 space-y-4">
        <li className="flex gap-3">
          <StepNumber n={1} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-medium">Tải file mẫu và điền câu hỏi</p>
            <p className="text-muted">
              Mở file mẫu bằng Excel hoặc Google Sheets. Mỗi <b>câu hỏi</b> là một <b>dòng</b>: gõ câu hỏi, các đáp án A–D rồi chọn đáp án đúng.
            </p>
            <a
              href={apiUrl("/templates/mau-nhap-cau-hoi.xlsx")}
              download="mau-nhap-cau-hoi.xlsx"
              className="btn-secondary btn-sm inline-flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" aria-hidden />
              Tải file mẫu Excel (.xlsx)
            </a>
          </div>
        </li>

        <li className="flex gap-3">
          <StepNumber n={2} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-medium">Chọn file đã điền</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv,text/csv"
                onChange={pickFile}
                className="hidden"
              />
              <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
                <Upload className="h-4 w-4" aria-hidden />
                Upload file excel câu hỏi
              </button>
              <span className="text-muted">{fileName ?? "Chưa chọn file"}</span>
            </div>
          </div>
        </li>

        <li className="flex gap-3">
          <StepNumber n={3} />
          <div className="min-w-0 flex-1">
            <button
              onClick={importCsv}
              disabled={busy || !csv.trim()}
              className="btn-primary btn-sm"
            >
              {busy ? "Đang nhập…" : "Nhập câu hỏi"}
            </button>
          </div>
        </li>
      </ol>

      {result && (
        <div className="mt-4 space-y-1 border-t border-token pt-3">
          <p className="font-medium text-success-700">
            ✓ Đã tạo {result.created}/{result.totalGroups} câu hỏi
          </p>
          {result.errors.length > 0 && (
            <ul className="space-y-0.5 text-danger-600">
              {result.errors.map((e, i) => (
                <li key={i}>
                  ✗ Câu &quot;{e.prompt}&quot; — {describeRowError(e.error)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
    </>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
      {n}
    </span>
  );
}

function describeRowError(code: string): string {
  if (code === "no_options") return "chưa có đáp án nào (cột option_label bị trống)";
  return code;
}

function describeFailure(error?: string, details?: unknown): string {
  if (error === "validation_failed") {
    const d = typeof details === "string" ? details : "";
    if (d === "empty") return "file rỗng";
    if (d === "no_data_rows") return "file chỉ có dòng tiêu đề, chưa có câu hỏi nào";
    if (d.startsWith("missing_column:")) return `thiếu cột "${d.slice("missing_column:".length)}" ở dòng tiêu đề`;
  }
  return `${error ?? "lỗi không xác định"} ${details ? JSON.stringify(details) : ""}`.trim();
}
