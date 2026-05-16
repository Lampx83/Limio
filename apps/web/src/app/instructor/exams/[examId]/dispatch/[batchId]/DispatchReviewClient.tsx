"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

type ItemStatus = "pending" | "sent" | "failed" | "skipped";
type BatchStatus = "draft" | "sending" | "completed" | "cancelled";

interface Item {
  id: string;
  recipientEmail: string;
  recipientName: string;
  selected: boolean;
  status: ItemStatus;
  errorMessage: string | null;
  sentAt: string | null;
  attemptCount: number;
}

interface Batch {
  id: string;
  title: string;
  status: BatchStatus;
  totalItems: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  createdByName: string;
  approvedByName: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  items: Item[];
}

const STATUS_LABEL: Record<ItemStatus, { text: string; cls: string }> = {
  pending: { text: "Chờ gửi", cls: "bg-slate-100 text-slate-700" },
  sent: { text: "Đã gửi", cls: "bg-emerald-100 text-emerald-800" },
  failed: { text: "Lỗi", cls: "bg-red-100 text-red-800" },
  skipped: { text: "Bỏ qua", cls: "bg-amber-100 text-amber-800" },
};

export default function DispatchReviewClient({
  examId,
  batch: initial,
  preview,
}: {
  examId: string;
  batch: Batch;
  preview: { subject: string; html: string; recipientName: string; recipientEmail: string } | null;
}) {
  const router = useRouter();
  const [batch, setBatch] = useState<Batch>(initial);
  const [pending, startTransition] = useTransition();
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const isDraft = batch.status === "draft";
  const isCompleted = batch.status === "completed";

  const selectedCount = useMemo(
    () => batch.items.filter((i) => i.selected).length,
    [batch.items],
  );

  async function onToggle(itemId: string, selected: boolean) {
    setTogglingIds((s) => new Set(s).add(itemId));
    // Optimistic update
    setBatch((b) => ({
      ...b,
      items: b.items.map((i) => (i.id === itemId ? { ...i, selected } : i)),
    }));
    try {
      const res = await fetch(
        `/api/dispatch-batches/${batch.id}/items/${itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ selected }),
        },
      );
      if (!res.ok) {
        // Roll back
        setBatch((b) => ({
          ...b,
          items: b.items.map((i) => (i.id === itemId ? { ...i, selected: !selected } : i)),
        }));
        toast.error("Lưu lựa chọn thất bại");
      }
    } finally {
      setTogglingIds((s) => {
        const n = new Set(s);
        n.delete(itemId);
        return n;
      });
    }
  }

  function onSelectAll(selected: boolean) {
    startTransition(async () => {
      for (const item of batch.items) {
        if (item.selected !== selected) await onToggle(item.id, selected);
      }
    });
  }

  function onApprove() {
    if (
      !confirm(
        `Sắp gửi email cho ${selectedCount} người. Tiếp tục?`,
      )
    )
      return;
    startTransition(async () => {
      const res = await fetch(`/api/dispatch-batches/${batch.id}/approve`, {
        method: "POST",
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error(e.error ?? "Gửi thất bại");
        return;
      }
      const data = (await res.json()) as {
        sent: number;
        failed: number;
        skipped: number;
      };
      toast.success(`Đã gửi ${data.sent} / lỗi ${data.failed} / bỏ qua ${data.skipped}`);
      router.refresh();
    });
  }

  function onCancel() {
    if (!confirm("Huỷ đợt gửi này? Không gửi cho ai cả.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/dispatch-batches/${batch.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Huỷ thất bại");
        return;
      }
      toast.success("Đã huỷ đợt gửi");
      router.push(`/instructor/courses/-/exams/${examId}#candidates`);
    });
  }

  function onResendFailed() {
    if (!confirm(`Gửi lại cho ${batch.failedCount} người thất bại?`)) return;
    startTransition(async () => {
      const res = await fetch(
        `/api/dispatch-batches/${batch.id}/resend-failed`,
        { method: "POST" },
      );
      if (!res.ok) {
        toast.error("Gửi lại thất bại");
        return;
      }
      const d = (await res.json()) as {
        retried: number;
        recovered: number;
        stillFailed: number;
      };
      toast.success(
        `Đã thử lại ${d.retried} — thành công ${d.recovered}, vẫn lỗi ${d.stillFailed}`,
      );
      router.refresh();
    });
  }

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="h-display text-2xl font-bold">{batch.title}</h1>
          <p className="mt-1 text-sm text-muted">
            Người tạo: <strong>{batch.createdByName}</strong>
            {batch.approvedByName && (
              <>
                {" · "}Duyệt bởi <strong>{batch.approvedByName}</strong> lúc{" "}
                {new Date(batch.approvedAt!).toLocaleString("vi-VN")}
              </>
            )}
          </p>
        </div>
        <StatusBadge status={batch.status} />
      </div>

      {/* Counters */}
      <div className="card mb-4 grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <Counter label="Tổng" value={batch.totalItems} />
        <Counter label="Đã gửi" value={batch.sentCount} accent="emerald" />
        <Counter label="Lỗi" value={batch.failedCount} accent="red" />
        <Counter label="Bỏ qua" value={batch.skippedCount} accent="amber" />
      </div>

      {isCompleted && batch.failedCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <span>
            ⚠ Có <strong>{batch.failedCount}</strong> email gửi thất bại.
          </span>
          <button
            onClick={onResendFailed}
            disabled={pending}
            className="btn btn-secondary text-xs"
          >
            Gửi lại cho người thất bại
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* LEFT: Email preview */}
        <div className="lg:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Nội dung email mẫu
          </p>
          {preview ? (
            <div className="rounded-lg border border-base-300 bg-white shadow-sm">
              <div className="border-b border-base-200 px-3 py-2 text-xs">
                <div>
                  <span className="text-muted">Tới: </span>
                  <span className="font-medium">{preview.recipientName}</span>{" "}
                  <span className="text-faint">&lt;{preview.recipientEmail}&gt;</span>
                </div>
                <div className="mt-1">
                  <span className="text-muted">Subject: </span>
                  <span className="font-medium">{preview.subject}</span>
                </div>
              </div>
              <iframe
                title="email preview"
                srcDoc={preview.html}
                sandbox=""
                className="h-[520px] w-full rounded-b-lg"
              />
              <p className="px-3 py-2 text-[11px] text-faint">
                Preview với data của người đầu tiên. Mỗi người nhận được email cá nhân hoá riêng.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">Không có người nhận.</p>
          )}
        </div>

        {/* RIGHT: Recipient list */}
        <div className="lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Danh sách người nhận ({batch.totalItems})
            </p>
            {isDraft && (
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() => onSelectAll(true)}
                  className="text-brand-700 hover:underline"
                  disabled={pending}
                >
                  Chọn tất cả
                </button>
                <span className="text-faint">·</span>
                <button
                  onClick={() => onSelectAll(false)}
                  className="text-brand-700 hover:underline"
                  disabled={pending}
                >
                  Bỏ chọn tất cả
                </button>
              </div>
            )}
          </div>
          <div className="card max-h-[520px] divide-y divide-base-200 overflow-y-auto">
            {batch.items.map((it) => {
              const meta = STATUS_LABEL[it.status];
              return (
                <div
                  key={it.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  {isDraft ? (
                    <input
                      type="checkbox"
                      checked={it.selected}
                      onChange={(e) => onToggle(it.id, e.target.checked)}
                      disabled={togglingIds.has(it.id)}
                      className="h-4 w-4"
                    />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {it.recipientName}
                    </div>
                    <div className="truncate text-xs text-muted">
                      {it.recipientEmail}
                    </div>
                    {it.errorMessage && (
                      <div className="mt-0.5 truncate text-xs text-red-700">
                        ⚠ {it.errorMessage}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${meta.cls}`}
                  >
                    {meta.text}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action bar */}
      {isDraft && (
        <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-base-300 bg-white p-3 shadow-lg">
          <button
            onClick={onCancel}
            disabled={pending}
            className="btn btn-ghost text-sm text-danger-700"
          >
            Huỷ đợt gửi
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">
              Sẽ gửi cho <strong>{selectedCount}</strong> /{" "}
              {batch.totalItems} người
            </span>
            <button
              onClick={onApprove}
              disabled={pending || selectedCount === 0}
              className="btn btn-primary text-sm"
            >
              {pending ? "Đang gửi..." : `Gửi cho ${selectedCount} người`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: BatchStatus }) {
  const map: Record<BatchStatus, { text: string; cls: string }> = {
    draft: { text: "Đang soạn", cls: "bg-slate-100 text-slate-700" },
    sending: { text: "Đang gửi…", cls: "bg-blue-100 text-blue-800" },
    completed: { text: "Đã gửi xong", cls: "bg-emerald-100 text-emerald-800" },
    cancelled: { text: "Đã huỷ", cls: "bg-amber-100 text-amber-800" },
  };
  const m = map[status];
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${m.cls}`}>
      {m.text}
    </span>
  );
}

function Counter({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "emerald" | "red" | "amber";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "red"
        ? "text-red-700"
        : accent === "amber"
          ? "text-amber-700"
          : "text-fg";
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
