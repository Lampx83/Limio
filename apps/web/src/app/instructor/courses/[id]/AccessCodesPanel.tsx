"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";
import { formatPrice } from "@/lib/formatPrice";

interface CodeRow {
  id: string;
  code: string;
  status: "unused" | "redeemed" | "revoked";
  priceCentsSnapshot: number | null;
  currency: string;
  redeemedBy: { email: string; displayName: string } | null;
  redeemedAt: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<CodeRow["status"], string> = {
  unused: "Chưa dùng",
  redeemed: "Đã kích hoạt",
  revoked: "Đã thu hồi",
};

const STATUS_CLASS: Record<CodeRow["status"], string> = {
  unused: "chip-brand",
  redeemed: "chip-success",
  revoked: "chip-danger",
};

/**
 * Sinh + quản lý mã kích hoạt cho khoá có phí. Học viên trả tiền cho giảng
 * viên ngoài hệ thống (chuyển khoản, tiền mặt — hệ thống không biết cách
 * nào); mỗi mã sinh ra ở đây gửi cho đúng một người, họ gõ vào là ghi danh
 * ngay, không cần ai duyệt lại lần hai.
 */
export default function AccessCodesPanel({ courseId }: { courseId: string }) {
  const [rows, setRows] = useState<CodeRow[] | null>(null);
  const [count, setCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl(`/api/courses/${courseId}/access-codes`));
    if (res.ok) {
      const data = (await res.json()) as { codes: CodeRow[] };
      setRows(data.codes);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const n = parseInt(count, 10);
    if (!Number.isInteger(n) || n < 1) {
      setErr("Nhập số mã muốn sinh (từ 1 trở lên).");
      return;
    }
    setBusy(true);
    const res = await fetch(apiUrl(`/api/courses/${courseId}/access-codes`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: n }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error === "validation_failed" ? "Số mã không hợp lệ." : "Sinh mã thất bại.");
      return;
    }
    setMsg(n === 1 ? "Đã sinh 1 mã." : `Đã sinh ${n} mã.`);
    setCount("1");
    void load();
  }

  async function revoke(id: string, code: string) {
    if (!confirm(`Thu hồi mã ${code}? Mã này sẽ không dùng được nữa.`)) return;
    setErr(null);
    const res = await fetch(apiUrl(`/api/courses/${courseId}/access-codes/${id}`), {
      method: "DELETE",
    });
    if (!res.ok) {
      setErr("Thu hồi thất bại — mã có thể đã được dùng.");
      return;
    }
    void load();
  }

  async function copy(id: string, code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  }

  const unusedCount = rows?.filter((r) => r.status === "unused").length ?? 0;

  return (
    <div>
      <header className="mb-3">
        <h2 className="text-base font-semibold">Mã kích hoạt</h2>
        <p className="mt-0.5 text-xs text-muted">
          Học viên thanh toán trực tiếp với bạn (chuyển khoản, tiền mặt — hệ
          thống không xử lý việc này). Sinh một mã, gửi cho đúng người đó; họ
          gõ mã vào trang khoá học là được ghi danh ngay lập tức.
        </p>
      </header>

      <form onSubmit={generate} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs font-medium text-muted" htmlFor="code-count">
            Số mã cần sinh
          </label>
          <input
            id="code-count"
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="input mt-1 w-24"
          />
        </div>
        <button type="submit" disabled={busy} className="btn-primary btn-sm disabled:opacity-50">
          {busy ? "Đang sinh…" : "Sinh mã"}
        </button>
        {unusedCount > 0 && (
          <span className="text-xs text-muted">{unusedCount} mã chưa dùng</span>
        )}
      </form>
      {err && <p className="mt-2 text-xs text-danger-600">{err}</p>}
      {msg && <p className="mt-2 text-xs text-success-600">{msg}</p>}

      {rows === null ? (
        <p className="mt-4 text-sm text-muted">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Chưa có mã nào.</p>
      ) : (
        <ul className="mt-4 divide-y divide-token">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
              <code className="rounded bg-[rgb(var(--surface-muted))] px-2 py-1 font-mono font-semibold tracking-wider">
                {r.code}
              </code>
              <span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>
              {r.priceCentsSnapshot !== null && (
                <span className="text-xs text-muted">
                  {formatPrice(r.priceCentsSnapshot, r.currency)}
                </span>
              )}
              {r.redeemedBy && (
                <span className="text-xs text-muted">
                  bởi {r.redeemedBy.displayName} ({r.redeemedBy.email})
                  {r.redeemedAt ? ` · ${formatDateTime(r.redeemedAt)}` : ""}
                </span>
              )}
              <span className="ml-auto flex shrink-0 gap-2">
                {r.status === "unused" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void copy(r.id, r.code)}
                      className="btn-ghost btn-sm"
                    >
                      {copiedId === r.id ? "Đã chép" : "Chép mã"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void revoke(r.id, r.code)}
                      className="btn-ghost btn-sm text-danger-600"
                    >
                      Thu hồi
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
