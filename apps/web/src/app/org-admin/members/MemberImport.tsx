"use client";

import { useRef, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

type Status = "new" | "existing" | "already_member" | "other_org" | "invalid_email" | "duplicate";

interface PreviewRow {
  line: number;
  email: string;
  displayName?: string;
  status: Status;
}
interface Preview {
  rows: PreviewRow[];
  counts: Record<Status, number>;
  actionable: number;
  canSendInvite: boolean;
}
interface ImportResult {
  results: { line: number; email: string; outcome: string; reason?: string; invited?: boolean }[];
  created: number;
  attached: number;
  skipped: number;
  failed: number;
}

const MAX_ROWS = 500;

const STATUS_LABEL: Record<Status, { text: string; chip: string }> = {
  new: { text: "Tạo tài khoản mới", chip: "chip-success" },
  existing: { text: "Gắn tài khoản sẵn có", chip: "chip-success" },
  already_member: { text: "Đã thuộc trường — bỏ qua", chip: "chip-accent" },
  other_org: { text: "Thuộc trường khác — bỏ qua", chip: "chip-warning" },
  invalid_email: { text: "Email không hợp lệ", chip: "chip-danger" },
  duplicate: { text: "Trùng dòng trước — bỏ qua", chip: "chip-accent" },
};

const ERROR_MESSAGES: Record<string, string> = {
  no_rows: "Không đọc được dòng nào — kiểm tra lại file/nội dung",
  too_many_rows: `Tối đa ${MAX_ROWS} dòng mỗi lần — hãy chia nhỏ file`,
  file_too_large: "File quá lớn (tối đa 2 MB)",
  no_file: "Chưa chọn file",
  unreadable_input: "Không đọc được file này",
  forbidden: "Bạn không có quyền thực hiện thao tác này",
};

function errorMessage(code: unknown): string {
  if (typeof code === "string" && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  return `Lỗi: ${code ?? "unknown"}`;
}

export default function MemberImport({
  organizationId,
  onImported,
}: {
  organizationId: string;
  onImported: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sendInvite, setSendInvite] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);

  const base = `/api/orgs/${organizationId}/members`;

  function reset() {
    setText("");
    setFileName(null);
    fileRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
    setPreview(null);
    setResult(null);
    setError(null);
  }

  async function runPreview() {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const file = fileRef.current;
      const res = file
        ? await fetch(apiUrl(`${base}/import/preview`), {
            method: "POST",
            body: (() => {
              const fd = new FormData();
              fd.append("file", file);
              return fd;
            })(),
          })
        : await fetch(apiUrl(`${base}/import/preview`), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text }),
          });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPreview(null);
        setError(errorMessage(body.error));
        return;
      }
      setPreview(body as Preview);
    } catch (err) {
      setError(`Lỗi mạng: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!preview) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`${base}/import`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rows: preview.rows.map(({ line, email, displayName }) => ({ line, email, displayName })),
          sendInvite,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(errorMessage(body.error));
        return;
      }
      setResult(body as ImportResult);
      setPreview(null);
      onImported();
    } catch (err) {
      setError(`Lỗi mạng: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="mb-4">
        <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm">
          Nhập hàng loạt từ file / danh sách
        </button>
      </div>
    );
  }

  const failedRows = result?.results.filter((r) => r.outcome === "failed") ?? [];
  const hasInput = fileRef.current !== null || text.trim().length > 0;

  return (
    <section className="card mb-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Nhập hàng loạt</h2>
          <p className="text-xs text-muted">
            Tải file .xlsx / .csv (cột <code>email</code>, <code>displayName</code>) hoặc dán mỗi
            dòng một người: <code>email, tên</code>. Tối đa {MAX_ROWS} dòng mỗi lần. Chỉ nhận user
            chưa thuộc trường nào.{" "}
            <a className="link" href={apiUrl(`${base}/template`)}>
              Tải file mẫu
            </a>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="btn-ghost btn-sm"
        >
          Đóng
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="mi-file" className="label">
            File
          </label>
          <input
            id="mi-file"
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="input mt-1"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              fileRef.current = f;
              setFileName(f?.name ?? null);
              setPreview(null);
              setResult(null);
            }}
          />
          {fileName && <p className="mt-1 text-xs text-faint">Dùng file: {fileName} (bỏ qua ô dán bên cạnh)</p>}
        </div>
        <div>
          <label htmlFor="mi-text" className="label">
            Hoặc dán danh sách
          </label>
          <textarea
            id="mi-text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(null);
              setResult(null);
            }}
            rows={4}
            className="input mt-1 font-mono text-xs"
            placeholder={"an@truong.edu.vn, Nguyễn Văn An\nbinh@truong.edu.vn, Trần Thị Bình"}
            disabled={fileRef.current !== null}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={runPreview} disabled={busy || !hasInput} className="btn-secondary">
          {busy && !preview ? "Đang đọc…" : "Xem trước"}
        </button>
        {(fileName || text || preview || result) && (
          <button type="button" onClick={reset} disabled={busy} className="btn-ghost btn-sm">
            Làm lại
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {preview && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {(Object.keys(STATUS_LABEL) as Status[])
              .filter((s) => preview.counts[s] > 0)
              .map((s) => (
                <span key={s} className={STATUS_LABEL[s].chip}>
                  {STATUS_LABEL[s].text}: {preview.counts[s]}
                </span>
              ))}
          </div>

          <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-token">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="sticky top-0 bg-base-50 text-left text-xs uppercase text-faint">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Dòng</th>
                  <th className="px-3 py-1.5 font-medium">Email</th>
                  <th className="px-3 py-1.5 font-medium">Tên</th>
                  <th className="px-3 py-1.5 font-medium">Kết quả dự kiến</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {preview.rows.map((r) => (
                  <tr key={`${r.line}-${r.email}`}>
                    <td className="px-3 py-1.5 tabular-nums text-faint">{r.line}</td>
                    <td className="px-3 py-1.5">{r.email || "—"}</td>
                    <td className="px-3 py-1.5 text-muted">{r.displayName ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      <span className={STATUS_LABEL[r.status].chip}>{STATUS_LABEL[r.status].text}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {preview.canSendInvite ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                  disabled={preview.counts.new === 0}
                />
                Gửi email mời đặt mật khẩu cho {preview.counts.new} tài khoản mới
              </label>
            ) : (
              <p className="text-xs text-muted">
                Import bởi admin nền tảng không gửi email. Người dùng mới đăng nhập bằng Google/SSO
                hoặc dùng &quot;Quên mật khẩu&quot; để tự đặt mật khẩu.
              </p>
            )}
            <button
              type="button"
              onClick={runImport}
              disabled={busy || preview.actionable === 0}
              className="btn-primary"
            >
              {busy ? "Đang nhập…" : `Nhập ${preview.actionable} người`}
            </button>
          </div>
          {preview.actionable === 0 && (
            <p className="mt-2 text-sm text-muted">Không có dòng nào cần thêm.</p>
          )}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-token p-3 text-sm">
          <p className="font-medium">
            Xong: tạo mới {result.created}, gắn sẵn có {result.attached}, bỏ qua {result.skipped}
            {result.failed > 0 && <span className="text-danger">, lỗi {result.failed}</span>}.
          </p>
          {failedRows.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-danger">
              {failedRows.map((r) => (
                <li key={r.line}>
                  Dòng {r.line} ({r.email}): {r.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
