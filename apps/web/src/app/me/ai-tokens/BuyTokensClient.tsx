"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

interface Pkg {
  id: string;
  name: string;
  tokens: number;
  priceVnd: number;
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

export default function BuyTokensClient({
  packages,
  orders,
  bank,
}: {
  packages: Pkg[];
  orders: Order[];
  bank: Bank;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bankReady = Boolean(bank.bankName && bank.accountNumber);
  const pending = orders.filter((o) => o.status === "pending");

  async function buy(packageId: string) {
    setBusy(packageId);
    setError(null);
    const r = await fetch(apiUrl("/api/ai/token-orders"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageId }),
    });
    setBusy(null);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(
        d.error === "too_many_pending"
          ? "Bạn đang có quá nhiều đơn chờ xác nhận. Chuyển khoản cho các đơn cũ trước đã."
          : (d.error ?? "Không tạo được đơn"),
      );
      return;
    }
    router.refresh();
  }

  return (
    <>
      {pending.length > 0 && (
        <section className="banner-info mt-6">
          <p className="font-semibold">
            Bạn có {pending.length} đơn đang chờ xác nhận
          </p>
          <p className="mt-1 text-sm">
            Chuyển khoản đúng số tiền và ghi <strong>mã đơn</strong> vào nội
            dung. Admin đối soát xong sẽ cộng token — thường trong ngày làm việc.
          </p>
          <ul className="mt-3 space-y-2">
            {pending.map((o) => (
              <li
                key={o.id}
                className="rounded-lg border border-token bg-[rgb(var(--surface))] p-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{o.packageName}</span>
                  <span className="font-semibold">{vnd(o.priceVnd)}</span>
                </div>
                <p className="mt-1 text-meta">
                  Nội dung chuyển khoản:{" "}
                  <code className="rounded bg-[rgb(var(--surface-muted))] px-1.5 py-0.5 font-mono font-semibold">
                    {o.code}
                  </code>
                </p>
              </li>
            ))}
          </ul>
          {bankReady ? (
            <p className="mt-3 text-sm">
              Chuyển tới: <strong>{bank.bankName}</strong> —{" "}
              <strong>{bank.accountNumber}</strong>
              {bank.accountName ? ` (${bank.accountName})` : ""}
            </p>
          ) : (
            <p className="mt-3 text-sm">
              Thông tin tài khoản nhận chưa được cấu hình — liên hệ admin trước
              khi chuyển tiền.
            </p>
          )}
        </section>
      )}

      <h2 className="text-h3 mt-8">Các gói</h2>
      {error && <p className="banner-danger mt-3 text-sm">{error}</p>}
      {packages.length === 0 ? (
        <p className="card mt-3 py-8 text-center text-meta">
          Hiện chưa có gói nào được mở bán.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <li key={p.id} className="card flex flex-col justify-between">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="mt-1 text-meta">
                  {p.tokens.toLocaleString("vi-VN")} token
                </p>
                <p className="text-h3 mt-2">{vnd(p.priceVnd)}</p>
              </div>
              <button
                type="button"
                onClick={() => void buy(p.id)}
                disabled={busy !== null}
                className="btn-primary btn-sm mt-4 disabled:opacity-50"
              >
                {busy === p.id ? "Đang tạo đơn..." : "Đặt mua"}
              </button>
            </li>
          ))}
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
                <span className="text-meta">
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
