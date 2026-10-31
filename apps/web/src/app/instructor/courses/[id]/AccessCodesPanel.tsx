"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { formatPrice } from "@/lib/formatPrice";

type CodeStatus = "unused" | "redeemed" | "revoked";

interface CodeRow {
  id: string;
  code: string;
  status: CodeStatus;
  priceCentsSnapshot: number | null;
  currency: string;
  redeemedBy: { email: string; displayName: string } | null;
  redeemedAt: string | null;
  createdAt: string;
}

interface BatchRow {
  id: string;
  label: string;
  note: string | null;
  count: number;
  accessDurationMonths: number | null;
  activateBefore: string | null;
  createdAt: string;
  stats: { unused: number; redeemed: number; revoked: number };
}

const STATUS_LABEL: Record<CodeStatus, string> = {
  unused: "Chưa dùng",
  redeemed: "Đã kích hoạt",
  revoked: "Đã thu hồi",
};

const STATUS_CLASS: Record<CodeStatus, string> = {
  unused: "chip-brand",
  redeemed: "chip-success",
  revoked: "chip-danger",
};

const BATCH_MAX = 10_000;

// Thời hạn hay dùng cho sách điện tử; null = vĩnh viễn (như các mã trước đây).
const DURATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Vĩnh viễn" },
  { value: "3", label: "3 tháng" },
  { value: "6", label: "6 tháng" },
  { value: "12", label: "1 năm" },
  { value: "24", label: "2 năm" },
  { value: "36", label: "3 năm" },
];

function durationLabel(months: number | null): string {
  if (months === null) return "Truy cập vĩnh viễn";
  if (months % 12 === 0) return `Truy cập ${months / 12} năm`;
  return `Truy cập ${months} tháng`;
}

/** Hạn kích hoạt đã qua? Mã chưa dùng của lô như vậy không đổi được nữa. */
function activationClosed(activateBefore: string | null): boolean {
  return activateBefore !== null && new Date(activateBefore).getTime() <= Date.now();
}

/**
 * Mã kích hoạt theo lô (docs/tieu-chi/hoc-lieu-nha-xuat-ban-P0.md, AC2). Mỗi lô là một đợt in (vd cả một đợt tái
 * bản sách): tạo một lần, xuất CSV cho nhà in, theo dõi bao nhiêu mã đã kích hoạt, thu hồi cả lô nếu in sai.
 * Mã vẫn là thứ giảng viên gửi / in cho người đã trả tiền ngoài hệ thống; học viên gõ mã là ghi danh ngay.
 */
export default function AccessCodesPanel({ courseId }: { courseId: string }) {
  const [batches, setBatches] = useState<BatchRow[] | null>(null);
  const [ungrouped, setUngrouped] = useState(0);
  const [label, setLabel] = useState("");
  const [count, setCount] = useState("100");
  const [note, setNote] = useState("");
  const [duration, setDuration] = useState("");
  const [activateBefore, setActivateBefore] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl(`/api/courses/${courseId}/access-code-batches`));
    if (res.ok) {
      const data = (await res.json()) as { batches: BatchRow[]; ungrouped: number };
      setBatches(data.batches);
      setUngrouped(data.ungrouped);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const n = Number(count);
    if (!label.trim()) {
      setErr("Đặt tên lô, ví dụ \"Tái bản 2026 — đợt 1\".");
      return;
    }
    if (!Number.isInteger(n) || n < 1 || n > BATCH_MAX) {
      setErr(`Số mã từ 1 đến ${BATCH_MAX.toLocaleString("vi-VN")}.`);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/courses/${courseId}/access-code-batches`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          count: n,
          note: note.trim() || undefined,
          accessDurationMonths: duration ? Number(duration) : null,
          activateBefore: activateBefore || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(
          data.error === "validation_failed"
            ? "Tên lô (tối đa 80 ký tự), số mã, thời hạn hoặc hạn kích hoạt (phải là ngày chưa qua) không hợp lệ."
            : data.error === "course_invite_only"
              ? "Khoá chỉ vào bằng link mời lớp nên không dùng mã kích hoạt."
              : "Tạo lô thất bại. Vui lòng thử lại.",
        );
        return;
      }
      setMsg(`Đã tạo lô "${label.trim()}" với ${n.toLocaleString("vi-VN")} mã.`);
      setLabel("");
      setNote("");
      setActivateBefore("");
      await load();
    } catch {
      setErr("Chưa kết nối được tới Limio. Hãy kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <header className="mb-3">
        <h2 className="text-base font-semibold">Mã kích hoạt</h2>
        <p className="mt-0.5 text-xs text-muted">
          Dùng cho người trả tiền ngoài hệ thống (chuyển khoản, tiền mặt, mã in trong sách). Tạo một lô mã, xuất
          CSV gửi nhà in hoặc gửi cho từng người; ai gõ mã vào là được ghi danh ngay, không cần ai duyệt lại.
        </p>
      </header>

      <form onSubmit={create} className="flex flex-wrap items-end gap-2">
        <div className="min-w-[14rem] flex-1">
          <label className="text-xs font-medium text-muted" htmlFor="batch-label">
            Tên lô
          </label>
          <input
            id="batch-label"
            value={label}
            maxLength={80}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Tái bản 2026 — đợt 1"
            className="input mt-1 w-full"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted" htmlFor="batch-count">
            Số mã
          </label>
          <input
            id="batch-count"
            type="number"
            min={1}
            max={BATCH_MAX}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="input mt-1 w-28"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted" htmlFor="batch-duration">
            Thời hạn truy cập
          </label>
          <select
            id="batch-duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="input mt-1 w-36"
          >
            {DURATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted" htmlFor="batch-activate-before">
            Kích hoạt trước ngày
          </label>
          <input
            id="batch-activate-before"
            type="date"
            value={activateBefore}
            onChange={(e) => setActivateBefore(e.target.value)}
            className="input mt-1 w-40"
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <label className="text-xs font-medium text-muted" htmlFor="batch-note">
            Ghi chú (không bắt buộc)
          </label>
          <input
            id="batch-note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            className="input mt-1 w-full"
          />
        </div>
        <button type="submit" disabled={busy} className="btn-primary btn-sm disabled:opacity-50">
          {busy ? "Đang tạo…" : "Tạo lô"}
        </button>
      </form>
      {err && <p className="mt-2 text-xs text-danger-600">{err}</p>}
      {msg && <p className="mt-2 text-xs text-success-600">{msg}</p>}

      <CodeLookup courseId={courseId} />

      {batches === null ? (
        <p className="mt-4 text-sm text-muted">Đang tải…</p>
      ) : batches.length === 0 && ungrouped === 0 ? (
        <p className="mt-4 text-sm text-muted">Chưa có lô mã nào.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {batches.map((b) => (
            <BatchCard key={b.id} courseId={courseId} batch={b} onChanged={load} />
          ))}
        </ul>
      )}

      {ungrouped > 0 && <UngroupedCodes courseId={courseId} total={ungrouped} onChanged={load} />}
    </div>
  );
}

function CodeLookup({ courseId }: { courseId: string }) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(apiUrl(`/api/courses/${courseId}/access-codes/lookup?code=${encodeURIComponent(code)}`));
      if (res.status === 404) {
        setResult("Không tìm thấy mã này trong khoá.");
        return;
      }
      if (!res.ok) {
        setResult("Không tra được. Vui lòng thử lại.");
        return;
      }
      const d = (await res.json()) as {
        status: CodeStatus;
        batch: { label: string; accessDurationMonths: number | null; activateBefore: string | null } | null;
        redeemedBy: { email: string; displayName: string } | null;
        redeemedAt: string | null;
      };
      setResult(
        [
          d.status === "unused" && activationClosed(d.batch?.activateBefore ?? null)
            ? "Hết hạn kích hoạt"
            : STATUS_LABEL[d.status],
          d.batch ? `lô "${d.batch.label}"` : "không thuộc lô nào",
          d.redeemedBy
            ? `bởi ${d.redeemedBy.displayName} (${d.redeemedBy.email})${d.redeemedAt ? ` · ${formatDateTime(d.redeemedAt)}` : ""}`
            : null,
        ]
          .filter(Boolean)
          .join(" · "),
      );
    } catch {
      setResult("Chưa kết nối được tới Limio.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={lookup} className="mt-4 flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="code-lookup">
        Tra cứu một mã
      </label>
      <input
        id="code-lookup"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Tra cứu một mã: XXXX-XXXX-XXXX"
        className="input w-64 font-mono"
      />
      <button type="submit" disabled={busy} className="btn-ghost btn-sm">
        Tra cứu
      </button>
      {result && <span className="text-xs text-muted">{result}</span>}
    </form>
  );
}

function BatchCard({
  courseId,
  batch,
  onChanged,
}: {
  courseId: string;
  batch: BatchRow;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const base = apiUrl(`/api/courses/${courseId}/access-code-batches/${batch.id}`);
  const closed = activationClosed(batch.activateBefore);

  async function revokeAll() {
    if (
      !confirm(
        `Thu hồi ${batch.stats.unused.toLocaleString("vi-VN")} mã chưa dùng của lô "${batch.label}"?\n` +
          "Mã đã kích hoạt không bị ảnh hưởng. Việc này không hoàn tác được.",
      )
    )
      return;
    setErr(null);
    const res = await fetch(base, { method: "DELETE" });
    if (!res.ok) {
      setErr("Thu hồi thất bại. Vui lòng thử lại.");
      return;
    }
    await onChanged();
  }

  return (
    <li className="rounded-xl border border-token p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold">{batch.label}</h3>
        <span className="text-xs text-muted">{formatDateTime(batch.createdAt)}</span>
      </div>
      {batch.note && <p className="mt-0.5 text-xs text-muted">{batch.note}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="chip">{batch.count.toLocaleString("vi-VN")} mã</span>
        <span className="chip">{durationLabel(batch.accessDurationMonths)}</span>
        {batch.activateBefore &&
          (closed ? (
            <span className="chip-danger">Hết hạn kích hoạt {formatDate(batch.activateBefore)}</span>
          ) : (
            <span className="chip">Kích hoạt trước {formatDate(batch.activateBefore)}</span>
          ))}
        <span className="chip-brand">{batch.stats.unused.toLocaleString("vi-VN")} chưa dùng</span>
        <span className="chip-success">{batch.stats.redeemed.toLocaleString("vi-VN")} đã kích hoạt</span>
        {batch.stats.revoked > 0 && (
          <span className="chip-danger">{batch.stats.revoked.toLocaleString("vi-VN")} đã thu hồi</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a href={`${base}/export?scope=unused`} className="btn-primary btn-sm" download>
          Xuất CSV mã chưa dùng
        </a>
        <a href={`${base}/export?scope=all`} className="btn-ghost btn-sm" download>
          Xuất cả lô
        </a>
        <button type="button" onClick={() => setOpen((o) => !o)} className="btn-ghost btn-sm">
          {open ? "Ẩn danh sách mã" : "Xem mã"}
        </button>
        {batch.stats.unused > 0 && (
          <button type="button" onClick={() => void revokeAll()} className="btn-ghost btn-sm ml-auto text-danger-600">
            Thu hồi cả lô
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-xs text-danger-600">{err}</p>}
      {open && (
        <BatchCodes
          url={`${base}/codes`}
          onChanged={onChanged}
          courseId={courseId}
          // Số liệu của lô đổi (thu hồi cả lô, có người kích hoạt) thì danh sách mã đang mở phải tải lại,
          // không thì vẫn hiện trạng thái cũ.
          refreshKey={`${batch.stats.unused}-${batch.stats.redeemed}-${batch.stats.revoked}`}
          activationClosed={closed}
        />
      )}
    </li>
  );
}

function BatchCodes({
  url,
  courseId,
  onChanged,
  refreshKey,
  activationClosed: closed,
}: {
  url: string;
  courseId: string;
  onChanged: () => Promise<void>;
  refreshKey: string;
  activationClosed: boolean;
}) {
  const [status, setStatus] = useState<"" | CodeStatus>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ rows: CodeRow[]; total: number; pageSize: number } | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ page: String(page), ...(status ? { status } : {}) });
    const res = await fetch(`${url}?${qs}`);
    if (res.ok) setData((await res.json()) as { rows: CodeRow[]; total: number; pageSize: number });
  }, [url, page, status]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function revokeOne(id: string, code: string) {
    if (!confirm(`Thu hồi mã ${code}? Mã này sẽ không dùng được nữa.`)) return;
    const res = await fetch(apiUrl(`/api/courses/${courseId}/access-codes/${id}`), { method: "DELETE" });
    if (res.ok) {
      await load();
      await onChanged();
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mt-3 border-t border-token pt-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <label htmlFor={`status-${url}`} className="text-muted">
          Lọc
        </label>
        <select
          id={`status-${url}`}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | CodeStatus);
            setPage(1);
          }}
          className="input w-40"
        >
          <option value="">Tất cả</option>
          <option value="unused">Chưa dùng</option>
          <option value="redeemed">Đã kích hoạt</option>
          <option value="revoked">Đã thu hồi</option>
        </select>
        {data && <span className="text-muted">{data.total.toLocaleString("vi-VN")} mã</span>}
      </div>

      {data === null ? (
        <p className="mt-3 text-sm text-muted">Đang tải…</p>
      ) : data.rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Không có mã nào.</p>
      ) : (
        <ul className="mt-2 divide-y divide-token">
          {data.rows.map((r) => (
            <CodeLine key={r.id} row={r} expired={closed} onRevoke={() => void revokeOne(r.id, r.code)} />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-ghost btn-sm">
            ← Trước
          </button>
          <span className="text-muted">
            Trang {page} / {pages}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="btn-ghost btn-sm">
            Sau →
          </button>
        </div>
      )}
    </div>
  );
}

function CodeLine({ row: r, expired = false, onRevoke }: { row: CodeRow; expired?: boolean; onRevoke: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(r.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <li className="flex flex-wrap items-center gap-3 py-2 text-sm">
      <code className="rounded bg-[rgb(var(--surface-muted))] px-2 py-1 font-mono font-semibold tracking-wider">
        {r.code}
      </code>
      {r.status === "unused" && expired ? (
        <span className="chip-danger">Hết hạn kích hoạt</span>
      ) : (
        <span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>
      )}
      {r.priceCentsSnapshot !== null && (
        <span className="text-xs text-muted">{formatPrice(r.priceCentsSnapshot, r.currency)}</span>
      )}
      {r.redeemedBy && (
        <span className="text-xs text-muted">
          bởi {r.redeemedBy.displayName} ({r.redeemedBy.email})
          {r.redeemedAt ? ` · ${formatDateTime(r.redeemedAt)}` : ""}
        </span>
      )}
      {r.status === "unused" && (
        <span className="ml-auto flex shrink-0 gap-2">
          <button type="button" onClick={() => void copy()} className="btn-ghost btn-sm">
            {copied ? "Đã chép" : "Chép mã"}
          </button>
          <button type="button" onClick={onRevoke} className="btn-ghost btn-sm text-danger-600">
            Thu hồi
          </button>
        </span>
      )}
    </li>
  );
}

/** Mã sinh trước khi có lô (hoặc sinh nhanh): vẫn xem và thu hồi từng mã như cũ, gom riêng một mục. */
function UngroupedCodes({ courseId, total, onChanged }: { courseId: string; total: number; onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CodeRow[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(apiUrl(`/api/courses/${courseId}/access-codes?ungrouped=1`));
    if (res.ok) setRows(((await res.json()) as { codes: CodeRow[] }).codes);
  }, [courseId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function revoke(id: string, code: string) {
    if (!confirm(`Thu hồi mã ${code}? Mã này sẽ không dùng được nữa.`)) return;
    const res = await fetch(apiUrl(`/api/courses/${courseId}/access-codes/${id}`), { method: "DELETE" });
    if (res.ok) {
      await load();
      await onChanged();
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-token p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-sm font-semibold">Mã lẻ (không thuộc lô nào)</h3>
        <span className="chip">{total.toLocaleString("vi-VN")} mã</span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="btn-ghost btn-sm ml-auto">
          {open ? "Ẩn" : "Xem mã"}
        </button>
      </div>
      {open &&
        (rows === null ? (
          <p className="mt-3 text-sm text-muted">Đang tải…</p>
        ) : (
          <ul className="mt-2 divide-y divide-token">
            {rows.map((r) => (
              <CodeLine key={r.id} row={r} onRevoke={() => void revoke(r.id, r.code)} />
            ))}
          </ul>
        ))}
    </div>
  );
}
