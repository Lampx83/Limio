"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Copy, Landmark, ShoppingCart, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import DateTime from "@/components/ui/DateTime";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge, { type StatusTone } from "@/components/ui/StatusBadge";

interface Pkg {
  id: string;
  name: string;
  tokens: number;
  priceVnd: number;
  estimatedTurns: number;
  estimatedGradableAnswers: number;
}
interface Order {
  id: string;
  code: string;
  status: string;
  tokens: number;
  priceVnd: number;
  packageName: string;
  createdAt: string;
}
interface Bank {
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
}

const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ xác nhận",
  paid: "Đã cộng token",
  cancelled: "Đã huỷ",
};
const STATUS_TONE: Record<string, StatusTone> = {
  pending: "warning",
  paid: "success",
  cancelled: "neutral",
};

export default function BuyTokensClient({
  packages,
  orders: initialOrders,
  bank,
  assumedEssayWords,
}: {
  packages: Pkg[];
  orders: Order[];
  bank: Bank;
  assumedEssayWords: number;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [confirmPkg, setConfirmPkg] = useState<Pkg | null>(null);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const bankReady = Boolean(bank.bankName && bank.accountNumber);
  const pending = orders.filter((o) => o.status === "pending");

  async function confirmBuy() {
    if (!confirmPkg) return;
    setBusy(true);
    setError(null);
    const r = await fetch(apiUrl("/api/ai/token-orders"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId: confirmPkg.id }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(
        d.error === "too_many_pending"
          ? "Bạn đang có quá nhiều đơn chờ xác nhận. Chuyển khoản cho các đơn cũ trước đã."
          : (d.error ?? "Không tạo được đơn"),
      );
      return;
    }
    const order: Order = {
      id: d.order.id,
      code: d.order.code,
      status: d.order.status,
      tokens: d.order.tokens,
      priceVnd: d.order.priceVnd,
      packageName: d.order.package?.name ?? confirmPkg.name,
      createdAt: d.order.createdAt,
    };
    setOrders((prev) => [order, ...prev]);
    setConfirmPkg(null);
    setCreatedOrder(order);
    router.refresh();
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyOrderCode(orderId: string, code: string) {
    await navigator.clipboard.writeText(code);
    setCopiedOrderId(orderId);
    setTimeout(() => setCopiedOrderId((id) => (id === orderId ? null : id)), 1500);
  }

  return (
    <>
      {pending.length > 0 && (
        <section className="mt-6 overflow-hidden rounded-xl border border-token">
          <div className="flex items-start gap-3 bg-[rgb(var(--surface-info))] px-5 py-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--surface))]">
              <Clock size={17} aria-hidden />
            </span>
            <div>
              <p className="font-semibold">
                Bạn có {pending.length} đơn đang chờ xác nhận
              </p>
              <p className="mt-0.5 text-sm">
                Chuyển khoản đúng số tiền, ghi <strong>mã đơn</strong> vào nội
                dung — admin đối soát xong sẽ cộng token, thường trong ngày
                làm việc.
              </p>
            </div>
          </div>

          <div className="border-t border-token bg-[rgb(var(--surface-muted))] px-5 py-3 text-sm">
            {bankReady ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Landmark size={15} className="shrink-0 text-[rgb(var(--text-muted))]" aria-hidden />
                <span className="text-meta">Chuyển tới</span>
                <span className="font-semibold">{bank.bankName}</span>
                <span className="font-mono">{bank.accountNumber}</span>
                {bank.accountName && (
                  <span className="text-meta">({bank.accountName})</span>
                )}
              </div>
            ) : (
              <p className="text-meta">
                Thông tin tài khoản nhận chưa được cấu hình — liên hệ admin
                trước khi chuyển tiền.
              </p>
            )}
          </div>

          <ul className="divide-y divide-[rgb(var(--border))] border-t border-token">
            {pending.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-[rgb(var(--surface))] px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{o.packageName}</p>
                  <p className="text-caption">{vnd(o.priceVnd)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-1.5 font-mono text-sm font-semibold tracking-wide">
                    {o.code}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyOrderCode(o.id, o.code)}
                    className="btn-secondary btn-sm gap-1.5"
                  >
                    {copiedOrderId === o.id ? (
                      <Check size={13} aria-hidden />
                    ) : (
                      <Copy size={13} aria-hidden />
                    )}
                    {copiedOrderId === o.id ? "Đã chép" : "Sao chép"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="text-h3 mt-8">Các gói</h2>
      <p className="mt-1 text-caption">
        * "Bài chấm" là ước lượng tương đối, giả định bài làm ~
        {assumedEssayWords} từ — số bài chấm được thực tế phụ thuộc độ dài bài
        làm.
      </p>
      {error && <p className="banner-danger mt-3 text-sm">{error}</p>}
      {packages.length === 0 ? (
        <EmptyState
          className="mt-3"
          icon="🪙"
          title="Hiện chưa có gói nào được mở bán"
          description="Quay lại sau hoặc liên hệ admin nếu bạn cần thêm token gấp."
        />
      ) : (
        <ul className="mt-3 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => {
            const perThousand = (p.priceVnd / p.tokens) * 1000;

            return (
              <li
                key={p.id}
                className="flex flex-col justify-between rounded-2xl border border-token bg-[rgb(var(--surface))] p-5"
              >
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="mt-3 text-h1">{vnd(p.priceVnd)}</p>
                  <p className="text-caption">
                    ≈ {perThousand.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}đ
                    / 1.000 token
                  </p>

                  <div className="mt-4 space-y-2 rounded-xl bg-[rgb(var(--surface-muted))] p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-meta">Token</span>
                      <span className="font-semibold">
                        {p.tokens.toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-meta">Ước tính</span>
                      <span className="font-semibold">
                        ≈ {p.estimatedTurns.toLocaleString("vi-VN")} lượt hỏi
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-meta">Chấm bài*</span>
                      <span className="font-semibold">
                        ≈ {p.estimatedGradableAnswers.toLocaleString("vi-VN")} bài
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmPkg(p)}
                  className="btn-secondary mt-5 w-full gap-1.5"
                >
                  <ShoppingCart size={14} aria-hidden />
                  Đặt mua
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {orders.length > 0 && (
        <>
          <h2 className="text-h3 mt-8">Lịch sử đơn</h2>
          <ul className="mt-3 space-y-2">
            {orders.map((o) => (
              <li
                key={o.id}
                className="card flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
              >
                <span className="font-mono">{o.code}</span>
                <span>{o.packageName}</span>
                <span>{o.tokens.toLocaleString("vi-VN")} token</span>
                <span>{vnd(o.priceVnd)}</span>
                <DateTime value={o.createdAt} format="date" className="text-meta" />
                <StatusBadge tone={STATUS_TONE[o.status] ?? "neutral"}>
                  {STATUS_LABEL[o.status] ?? o.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </>
      )}

      {confirmPkg && (
        <ConfirmDialog
          pkg={confirmPkg}
          bank={bank}
          bankReady={bankReady}
          busy={busy}
          error={error}
          onCancel={() => {
            setConfirmPkg(null);
            setError(null);
          }}
          onConfirm={() => void confirmBuy()}
        />
      )}

      {createdOrder && (
        <SuccessDialog
          order={createdOrder}
          bank={bank}
          bankReady={bankReady}
          copied={copied}
          onCopy={() => void copyCode(createdOrder.code)}
          onClose={() => setCreatedOrder(null)}
        />
      )}
    </>
  );
}

function DialogShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-sm rounded-xl bg-[rgb(var(--surface))] p-5 shadow-xl">
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({
  pkg,
  bank,
  bankReady,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  pkg: Pkg;
  bank: Bank;
  bankReady: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogShell onClose={busy ? undefined : onCancel}>
      <div className="flex items-start justify-between">
        <h3 className="text-h4">Xác nhận đặt mua</h3>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          aria-label="Đóng"
          className="rounded p-1 text-[rgb(var(--text-muted))] hover:bg-[rgb(var(--surface-muted))] disabled:opacity-50"
        >
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 space-y-1.5 rounded-lg bg-[rgb(var(--surface-muted))] p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-meta">Gói</span>
          <span className="font-medium">{pkg.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-meta">Token</span>
          <span className="font-medium">{pkg.tokens.toLocaleString("vi-VN")}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-meta">Số tiền</span>
          <span className="font-semibold">{vnd(pkg.priceVnd)}</span>
        </div>
      </div>

      <p className="mt-3 text-sm text-meta">
        {bankReady
          ? "Sau khi xác nhận, bạn sẽ nhận một mã đơn để ghi vào nội dung chuyển khoản. Admin đối soát xong sẽ cộng token, thường trong ngày làm việc."
          : "Thông tin tài khoản nhận chưa được cấu hình — bạn vẫn có thể đặt đơn, nhưng hãy liên hệ admin trước khi chuyển tiền."}
      </p>

      {error && <p className="banner-danger mt-3 text-sm">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary btn-sm">
          Huỷ
        </button>
        <button type="button" onClick={onConfirm} disabled={busy} className="btn-primary btn-sm">
          {busy ? "Đang tạo đơn..." : "Xác nhận mua"}
        </button>
      </div>
    </DialogShell>
  );
}

function SuccessDialog({
  order,
  bank,
  bankReady,
  copied,
  onCopy,
  onClose,
}: {
  order: Order;
  bank: Bank;
  bankReady: boolean;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <DialogShell onClose={onClose}>
      <div className="flex items-center gap-2 text-[rgb(var(--brand))]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--brand-soft))]">
          <Check size={16} />
        </span>
        <h3 className="text-h4 text-[rgb(var(--text))]">Đã tạo đơn</h3>
      </div>

      <p className="mt-3 text-sm">
        Chuyển khoản đúng <strong>{vnd(order.priceVnd)}</strong> và ghi mã đơn
        sau vào nội dung chuyển khoản:
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-center font-mono text-lg font-semibold">
          {order.code}
        </code>
        <button
          type="button"
          onClick={onCopy}
          className="btn-secondary btn-sm shrink-0"
        >
          {copied ? "Đã chép" : "Sao chép"}
        </button>
      </div>

      {bankReady ? (
        <p className="mt-3 text-sm">
          Chuyển tới: <strong>{bank.bankName}</strong> —{" "}
          <strong>{bank.accountNumber}</strong>
          {bank.accountName ? ` (${bank.accountName})` : ""}
        </p>
      ) : (
        <p className="mt-3 text-sm text-meta">
          Thông tin tài khoản nhận chưa được cấu hình — liên hệ admin trước khi
          chuyển tiền.
        </p>
      )}

      <button type="button" onClick={onClose} className="btn-primary btn-sm mt-5 w-full">
        Đã hiểu
      </button>
    </DialogShell>
  );
}
