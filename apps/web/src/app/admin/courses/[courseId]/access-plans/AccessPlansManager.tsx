"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatPrice } from "@/lib/formatPrice";

interface Plan {
  id: string;
  label: string;
  durationMonths: number | null;
  priceCents: number;
  currency: string;
  isActive: boolean;
}

function durationLabel(months: number | null): string {
  if (months === null) return "Vĩnh viễn";
  if (months % 12 === 0) return `${months / 12} năm`;
  return `${months} tháng`;
}

/** Form fields shared by create + inline edit. */
function PlanFields({
  label,
  setLabel,
  lifetime,
  setLifetime,
  months,
  setMonths,
  price,
  setPrice,
  currency,
  setCurrency,
}: {
  label: string;
  setLabel: (v: string) => void;
  lifetime: boolean;
  setLifetime: (v: boolean) => void;
  months: string;
  setMonths: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
  currency: string;
  setCurrency: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[160px] flex-1">
        <label className="label">Tên gói</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="input mt-1"
          placeholder="vd: 1 năm"
        />
      </div>
      <div>
        <label className="label">Thời hạn</label>
        <div className="mt-1 flex items-center gap-2">
          <select
            value={lifetime ? "lifetime" : "limited"}
            onChange={(e) => setLifetime(e.target.value === "lifetime")}
            className="select"
          >
            <option value="limited">Có thời hạn</option>
            <option value="lifetime">Vĩnh viễn</option>
          </select>
          {!lifetime && (
            <input
              type="number"
              min={1}
              max={120}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="input w-24"
              placeholder="số tháng"
            />
          )}
        </div>
      </div>
      <div className="min-w-[140px]">
        <label className="label">Giá</label>
        <input
          type="number"
          min={0}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="input mt-1"
          placeholder="500000"
        />
      </div>
      <div>
        <label className="label">Tiền tệ</label>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="select mt-1">
          <option value="VND">VND</option>
          <option value="USD">USD</option>
        </select>
      </div>
    </div>
  );
}

export default function AccessPlansManager({
  courseId,
  defaultCurrency,
}: {
  courseId: string;
  defaultCurrency: string;
}) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [lifetime, setLifetime] = useState(false);
  const [months, setMonths] = useState("12");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [eLabel, setELabel] = useState("");
  const [eLifetime, setELifetime] = useState(false);
  const [eMonths, setEMonths] = useState("12");
  const [ePrice, setEPrice] = useState("");
  const [eCurrency, setECurrency] = useState(defaultCurrency);
  const [savingEdit, setSavingEdit] = useState(false);

  function load() {
    setLoading(true);
    fetch(apiUrl(`/api/admin/courses/${courseId}/access-plans`))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { plans: Plan[] } | null) => setPlans(d?.plans ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(load, [courseId]);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/courses/${courseId}/access-plans`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label,
          durationMonths: lifetime ? null : Number(months),
          priceCents: Math.round(Number(price)),
          currency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error === "validation_failed" ? "Vui lòng kiểm tra lại các trường." : `Lỗi: ${data.error ?? res.status}`);
        return;
      }
      setLabel("");
      setLifetime(false);
      setMonths("12");
      setPrice("");
      load();
    } catch (err) {
      setError(`Lỗi mạng: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  }

  function startEdit(p: Plan) {
    setEditingId(p.id);
    setELabel(p.label);
    setELifetime(p.durationMonths === null);
    setEMonths(String(p.durationMonths ?? 12));
    setEPrice(String(p.priceCents));
    setECurrency(p.currency);
  }

  async function saveEdit(planId: string) {
    setSavingEdit(true);
    try {
      const res = await fetch(
        apiUrl(`/api/admin/courses/${courseId}/access-plans/${planId}`),
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            label: eLabel,
            durationMonths: eLifetime ? null : Number(eMonths),
            priceCents: Math.round(Number(ePrice)),
            currency: eCurrency,
          }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Không lưu được: ${data.error ?? res.status}`);
        return;
      }
      setEditingId(null);
      load();
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(p: Plan) {
    await fetch(apiUrl(`/api/admin/courses/${courseId}/access-plans/${p.id}`), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    load();
  }

  return (
    <>
      <form onSubmit={createPlan} className="card mb-4">
        <h2 className="mb-2 text-base font-semibold">Thêm gói mới</h2>
        <PlanFields
          label={label}
          setLabel={setLabel}
          lifetime={lifetime}
          setLifetime={setLifetime}
          months={months}
          setMonths={setMonths}
          price={price}
          setPrice={setPrice}
          currency={currency}
          setCurrency={setCurrency}
        />
        <div className="mt-3">
          <button type="submit" disabled={creating || !label || !price} className="btn-primary">
            {creating ? "Đang thêm…" : "Thêm gói"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full text-sm">
          <thead className="border-b border-token bg-base-50 text-xs uppercase text-faint">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Gói</th>
              <th className="px-4 py-2 text-left font-medium">Thời hạn</th>
              <th className="px-4 py-2 text-left font-medium">Giá</th>
              <th className="px-4 py-2 text-left font-medium">Trạng thái</th>
              <th className="px-4 py-2 text-right font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {loading && !plans && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Đang tải…
                </td>
              </tr>
            )}
            {plans?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  Chưa có gói nào — khoá học đang bán theo giá vĩnh viễn cũ (nếu có).
                </td>
              </tr>
            )}
            {plans?.map((p) =>
              editingId === p.id ? (
                <tr key={p.id} className="bg-base-50">
                  <td colSpan={5} className="px-4 py-3">
                    <PlanFields
                      label={eLabel}
                      setLabel={setELabel}
                      lifetime={eLifetime}
                      setLifetime={setELifetime}
                      months={eMonths}
                      setMonths={setEMonths}
                      price={ePrice}
                      setPrice={setEPrice}
                      currency={eCurrency}
                      setCurrency={setECurrency}
                    />
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(p.id)}
                        disabled={savingEdit}
                        className="btn-primary btn-sm"
                      >
                        {savingEdit ? "Đang lưu…" : "Lưu"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="btn-ghost btn-sm"
                      >
                        Huỷ
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={p.id} className="hover:bg-base-50">
                  <td className="px-4 py-2.5 font-medium">{p.label}</td>
                  <td className="px-4 py-2.5 text-muted">{durationLabel(p.durationMonths)}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    {formatPrice(p.priceCents, p.currency)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={p.isActive ? "chip-success" : "chip"}>
                      {p.isActive ? "Đang bán" : "Đã tắt"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="btn-secondary btn-sm"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(p)}
                        className="btn-ghost btn-sm"
                      >
                        {p.isActive ? "Tắt" : "Bật lại"}
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
