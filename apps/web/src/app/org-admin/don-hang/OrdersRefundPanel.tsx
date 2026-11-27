"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";
import { formatPrice } from "@/lib/formatPrice";

interface OrderRow {
  id: string;
  code: string;
  amountCents: number;
  currency: string;
  provider: string;
  status: "paid" | "refunded";
  paidAt: string | null;
  refundedAt: string | null;
}

const PROVIDER_LABEL: Record<string, string> = {
  stripe: "Thẻ quốc tế (Stripe)",
  vnpay: "VNPay",
  momo: "MoMo",
  sepay: "Chuyển khoản (SePay)",
  sepay_pg: "Cổng SePay",
};

const ERROR_TEXT: Record<string, string> = {
  order_not_found: "Không tìm thấy đơn này.",
  not_paid: "Đơn chưa trả tiền nên không có gì để hoàn.",
  unsupported_order: "Đơn combo hoàn riêng, trang này chưa xử lý.",
  forbidden: "Thầy/cô không có quyền với khoá này.",
};

export default function OrdersRefundPanel({ courseId, courseTitle }: { courseId: string; courseTitle: string }) {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"" | "paid" | "refunded">("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    if (code.trim()) qs.set("code", code.trim());
    if (status) qs.set("status", status);
    const res = await fetch(apiUrl(`/api/courses/${courseId}/publisher-orders?${qs}`), { cache: "no-store" });
    if (res.ok) setOrders(((await res.json()) as { orders: OrderRow[] }).orders);
    else setErr("Không tải được danh sách đơn.");
  }, [courseId, code, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function refund(orderId: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(apiUrl(`/api/courses/${courseId}/publisher-orders/${orderId}/refund`), { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; alreadyRefunded?: boolean; enrollmentRevoked?: boolean };
      if (!res.ok) {
        setErr(ERROR_TEXT[data.error ?? ""] ?? "Chưa thực hiện được, thử lại sau.");
      } else if (data.alreadyRefunded) {
        setMsg("Đơn này đã được hoàn từ trước.");
      } else {
        setMsg(data.enrollmentRevoked ? "Đã ghi nhận hoàn tiền và đóng quyền học của người mua." : "Đã ghi nhận hoàn tiền. Người mua vẫn còn quyền học vì có đơn hoặc mã kích hoạt khác cho khoá này.");
      }
      setConfirming(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={`Đơn của ${courseTitle}`}>
      <h2 className="text-h3 mb-3">{courseTitle}</h2>
      <div className="banner-info mb-4 text-sm">
        <p>
          Hệ thống <strong>không chuyển tiền</strong>. Hoàn tiền thật cho người mua ở cổng thanh toán hoặc ngân hàng trước, rồi bấm xác nhận ở đây để đơn đổi sang “Đã hoàn” và quyền học của người mua đóng lại. Đơn Stripe hoàn trên Stripe thì tự cập nhật.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Tìm theo mã đơn"
          aria-label="Tìm theo mã đơn"
          className="input w-48"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value as "" | "paid" | "refunded")} aria-label="Lọc theo trạng thái" className="input w-40">
          <option value="">Tất cả đơn</option>
          <option value="paid">Đã trả tiền</option>
          <option value="refunded">Đã hoàn</option>
        </select>
      </div>

      {msg && <div role="status" className="banner-success mb-3 text-sm"><p>{msg}</p></div>}
      {err && <div role="alert" className="banner-danger mb-3 text-sm"><p>{err}</p></div>}

      {orders === null ? (
        <p className="text-sm text-muted">Đang tải…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted">Chưa có đơn nào khớp.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-token">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--surface-muted))] text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-3 py-2">Mã đơn</th>
                <th className="px-3 py-2">Số tiền</th>
                <th className="px-3 py-2">Cổng</th>
                <th className="px-3 py-2">Trả lúc</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-token">
                  <td className="max-w-[14rem] break-all px-3 py-2 font-mono">{o.code}</td>
                  <td className="px-3 py-2">{formatPrice(o.amountCents, o.currency)}</td>
                  <td className="px-3 py-2">{PROVIDER_LABEL[o.provider] ?? o.provider}</td>
                  <td className="px-3 py-2">{o.paidAt ? formatDateTime(o.paidAt) : "—"}</td>
                  <td className="px-3 py-2">
                    {o.status === "refunded" ? <span className="chip-accent">Đã hoàn{o.refundedAt ? ` ${formatDateTime(o.refundedAt)}` : ""}</span> : <span className="chip-success">Đã trả tiền</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {o.status === "paid" &&
                      (confirming === o.id ? (
                        <span className="flex flex-wrap items-center justify-end gap-2">
                          <span className="w-full text-xs text-muted">Đã hoàn tiền cho người mua?</span>
                          <button type="button" disabled={busy} onClick={() => void refund(o.id)} className="btn-pill whitespace-nowrap !bg-red-600 !text-white disabled:opacity-60">
                            Xác nhận đã hoàn
                          </button>
                          <button type="button" disabled={busy} onClick={() => setConfirming(null)} className="btn-pill whitespace-nowrap">
                            Thôi
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirming(o.id)} className="btn-pill">
                          Hoàn tiền
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
