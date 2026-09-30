"use client";

import { useRef, useState } from "react";
import { Download, FileSpreadsheet, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { StatusBadge, type StatusTone } from "@/components/ui";

type RowStatus = "ok" | "missing_name" | "duplicate_in_file" | "name_exists";

interface PreviewRow {
  line: number;
  name: string;
  termLabel?: string;
  note?: string;
  status: RowStatus;
}

interface Preview {
  rows: PreviewRow[];
  counts: Record<RowStatus, number>;
  actionable: number;
}

const STATUS: Record<RowStatus, { text: string; tone: StatusTone }> = {
  ok: { text: "Sẵn sàng", tone: "success" },
  missing_name: { text: "Thiếu tên lớp", tone: "danger" },
  duplicate_in_file: { text: "Trùng tên trong file", tone: "danger" },
  name_exists: { text: "Tên lớp đã có trong khoá", tone: "danger" },
};

const ERRORS: Record<string, string> = {
  no_file: "Chưa chọn file.",
  file_too_large: "File quá lớn (tối đa 2 MB).",
  unreadable_input: "Không đọc được file — dùng .xlsx, .xls hoặc .csv.",
  no_rows: "File không có dòng nào để nhập.",
  too_many_rows: "Tối đa 200 lớp mỗi lần nhập.",
  forbidden: "Bạn không có quyền tạo lớp cho khoá này.",
};

/** Import hàng loạt lớp học từ Excel: chọn file → xem trước từng dòng → tạo các dòng hợp lệ. */
export default function SectionImportPanel({
  courseId,
  onDone,
  onClose,
}: {
  courseId: string;
  /** Gọi sau khi đã tạo ít nhất một lớp, để danh sách tải lại. */
  onDone: () => void;
  onClose: () => void;
}) {
  const base = apiUrl(`/api/courses/${courseId}/sections/import`);
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Array<{ line: number; name: string; error: string }>>([]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    setFailed([]);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${base}/preview`, { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as Preview & { error?: string };
      if (!res.ok) {
        setError(ERRORS[data.error ?? ""] ?? `Không đọc được file (${data.error ?? res.status}).`);
        return;
      }
      setPreview(data);
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
    }
  }

  async function onImport() {
    if (!preview || preview.actionable === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: preview.rows.map((r) => ({
            line: r.line,
            name: r.name,
            termLabel: r.termLabel,
            note: r.note,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        created?: number;
        failed?: Array<{ line: number; name: string; error: string }>;
        error?: string;
      };
      if (!res.ok) {
        setError(ERRORS[data.error ?? ""] ?? `Nhập thất bại (${data.error ?? res.status}).`);
        return;
      }
      const created = data.created ?? 0;
      if (created > 0) {
        toast.success(`Đã tạo ${created} lớp học`);
        onDone();
      }
      // Chỉ các dòng lỗi lúc tạo (đã qua xem trước nên hiếm) — dòng "không hợp lệ" đã hiện sẵn ở bảng.
      setFailed((data.failed ?? []).filter((f) => !Object.keys(STATUS).includes(f.error)));
      if ((data.failed ?? []).length === 0) onClose();
      else setPreview(null);
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
    }
  }

  const invalid = preview ? preview.rows.length - preview.actionable : 0;

  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-h4">Nhập lớp học từ Excel</h3>
          <p className="mt-1 text-meta">
            Mỗi dòng một lớp, gồm 3 cột: <b>Tên lớp</b>, <b>Kỳ học</b> (gõ chữ, vd HK1 2026-27) và <b>Ghi chú</b>.
            Chỉ cột Tên lớp là bắt buộc.
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-ghost btn-sm" aria-label="Đóng">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <a href={`${base.replace(/import$/, "template")}`} className="btn-secondary btn-sm" download>
          <Download className="h-3.5 w-3.5" aria-hidden />
          Tải file mẫu
        </a>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onPick}
          className="sr-only"
          id="section-import-file"
        />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-primary btn-sm">
          <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
          {fileName ? "Chọn file khác" : "Chọn file Excel"}
        </button>
        {fileName && <span className="text-xs text-muted">{fileName}</span>}
      </div>

      {busy && !preview && <p className="text-meta">Đang xử lý…</p>}
      {error && (
        <p role="alert" className="banner-danger text-sm">
          {error}
        </p>
      )}
      {failed.length > 0 && (
        <div role="alert" className="banner-warning text-sm">
          <p className="font-medium">Một số dòng không tạo được:</p>
          <ul className="mt-1 list-disc pl-5">
            {failed.map((f) => (
              <li key={f.line}>
                Dòng {f.line} ({f.name}): {f.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <>
          <p className="text-sm">
            <b>{preview.actionable}</b> lớp sẵn sàng tạo
            {invalid > 0 && (
              <>
                , <b className="text-danger-700">{invalid}</b> dòng có lỗi sẽ bị bỏ qua
              </>
            )}
            .
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-token">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="sticky top-0 bg-[rgb(var(--surface-muted))] text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Dòng</th>
                  <th className="px-3 py-2 font-medium">Tên lớp</th>
                  <th className="px-3 py-2 font-medium">Kỳ học</th>
                  <th className="px-3 py-2 font-medium">Ghi chú</th>
                  <th className="px-3 py-2 font-medium">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border))]">
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.status === "ok" ? "" : "bg-danger-50/50"}>
                    <td className="px-3 py-2 text-faint">{r.line}</td>
                    <td className="px-3 py-2 font-medium">{r.name || "—"}</td>
                    <td className="px-3 py-2">{r.termLabel ?? "—"}</td>
                    <td className="px-3 py-2">{r.note ?? "—"}</td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={STATUS[r.status].tone} dot={false}>
                        {STATUS[r.status].text}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onClose} disabled={busy} className="btn-secondary btn-sm">
              Huỷ
            </button>
            <button
              type="button"
              onClick={onImport}
              disabled={busy || preview.actionable === 0}
              className="btn-primary btn-sm"
            >
              {busy ? "Đang tạo…" : `Tạo ${preview.actionable} lớp`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
