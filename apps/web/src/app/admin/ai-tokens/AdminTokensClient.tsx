"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

interface Row {
  id: string;
  code: string;
  status: string;
  tokens: number;
  priceVnd: number;
  packageName: string;
  email: string;
  displayName: string;
  createdAt: string;
}

const vnd = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
const TABS = [
  { key: "pending", label: "Chờ xác nhận" },
  { key: "paid", label: "Đã cộng" },
  { key: "cancelled", label: "Đã huỷ" },
  { key: "all", label: "Tất cả" },
] as const;

export default function AdminTokensClient({
  orders,
  status,
}: {
  orders: Row[];
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [adjust, setAdjust] = useState({ email: "", amount: "", note: "" });

  async function act(id: string, action: "confirm" | "cancel") {
    if (
      action === "cancel" &&
      !window.confirm("Huỷ đơn này? Người mua sẽ không được cộng token.")
    ) {
      return;
    }
    setBusy(id);
    setMsg(null);
    const r = await fetch(apiUrl(`/api/admin/ai-token-orders/${id}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      setMsg(`Lỗi: ${d.error ?? r.status}`);
      return;
    }
    if (action === "confirm") {
      setMsg(
        d.credited
          ? `Đã cộng ${Number(d.tokens).toLocaleString("vi-VN")} token.`
          : "Đơn này đã được cộng token từ trước — không cộng lại.",
      );
    }
    router.refresh();
  }

  async function submitAdjust() {
    const amount = Number(adjust.amount);
    if (!adjust.email.trim() || !Number.isFinite(amount) || amount === 0) {
      setMsg("Nhập email và số token khác 0.");
      return;
    }
    setBusy("adjust");
    setMsg(null);
    const r = await fetch(apiUrl("/api/admin/ai-tokens/adjust"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: adjust.email.trim(),
        amount,
        note: adjust.note.trim() || undefined,
      }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) {
      setMsg(`Lỗi: ${d.error ?? r.status}`);
      return;
    }
    setMsg(
      `Xong. Số dư mới: ${Number(d.budget?.total ?? 0).toLocaleString("vi-VN")} token.`,
    );
    setAdjust({ email: "", amount: "", note: "" });
  }

  return (
    <>
      <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-token">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/ai-tokens?status=${t.key}`}
            prefetch={false}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${
              status === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-muted hover:text-default"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {msg && <p className="banner-info mt-4 text-sm">{msg}</p>}

      {orders.length === 0 ? (
        <p className="card mt-4 py-10 text-center text-meta">
          Không có đơn nào ở trạng thái này.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-caption">
              <tr className="border-b border-token">
                <th className="px-3 py-2">Mã</th>
                <th className="px-3 py-2">Người mua</th>
                <th className="px-3 py-2">Gói</th>
                <th className="px-3 py-2 text-right">Số tiền</th>
                <th className="px-3 py-2 text-right">Token</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-token">
                  <td className="px-3 py-2 font-mono font-semibold">{o.code}</td>
                  <td className="px-3 py-2">
                    <p>{o.displayName}</p>
                    <p className="text-caption">{o.email}</p>
                  </td>
                  <td className="px-3 py-2">{o.packageName}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {vnd(o.priceVnd)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {o.tokens.toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {o.status === "pending" ? (
                      <span className="inline-flex gap-2">
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void act(o.id, "confirm")}
                          className="btn-primary btn-sm disabled:opacity-50"
                        >
                          Đã nhận tiền
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void act(o.id, "cancel")}
                          className="btn-ghost btn-sm disabled:opacity-50"
                        >
                          Huỷ
                        </button>
                      </span>
                    ) : (
                      <span className="text-meta">
                        {o.status === "paid" ? "đã cộng" : "đã huỷ"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="card mt-8">
        <h2 className="text-h3">Cộng/trừ token thủ công</h2>
        <p className="mt-1 text-meta">
          Dùng khi người học cạn hạn mức đúng lúc cần mà chưa kịp mua, hoặc để
          sửa sai sót đối soát. Số âm là trừ đi.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_2fr_auto]">
          <input
            type="email"
            value={adjust.email}
            onChange={(e) => setAdjust({ ...adjust, email: e.target.value })}
            placeholder="email người học"
            className="input"
          />
          <input
            type="number"
            value={adjust.amount}
            onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })}
            placeholder="số token"
            className="input"
          />
          <input
            type="text"
            value={adjust.note}
            onChange={(e) => setAdjust({ ...adjust, note: e.target.value })}
            placeholder="lý do (ghi vào sổ cái)"
            className="input"
          />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void submitAdjust()}
            className="btn-secondary btn-sm disabled:opacity-50"
          >
            Áp dụng
          </button>
        </div>
      </section>
    </>
  );
}
