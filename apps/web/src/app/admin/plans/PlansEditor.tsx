"use client";

import { useCallback, useEffect, useState } from "react";
import { PLAN_BOOLEAN_KEYS, PLAN_LIMIT_KEYS, TECH_CEILINGS } from "@feedbackme/shared-types";
import { apiUrl } from "@/lib/apiUrl";
import { BOOLEAN_LABELS, LIMIT_HINTS, LIMIT_LABELS, PLANS_DISABLED_TEXT, planErrorText } from "@/lib/planAdminUi";
import StatusBadge from "@/components/ui/StatusBadge";

interface Price { period: "month" | "year"; amountVnd: number; active: boolean }
interface PlanRow {
  key: string;
  name: string;
  scope: "individual" | "organization";
  entitlements: Record<string, number | boolean>;
  isPublic: boolean;
  active: boolean;
  sortOrder: number;
  prices: Price[];
  activeSubscriptions: number;
}

export default function PlansEditor() {
  const [plans, setPlans] = useState<PlanRow[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(apiUrl("/api/admin/plans"));
    if (!r.ok) {
      setError(planErrorText((await r.json().catch(() => ({}))).error));
      return;
    }
    const d = await r.json();
    setPlans(d.plans);
    setEnabled(d.plansEnabled);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mt-4">
      {!enabled && <p className="banner-info mb-4">{PLANS_DISABLED_TEXT}</p>}
      {error && <p className="banner-danger mb-4">{error}</p>}
      {plans === null && !error && <p className="text-meta">Đang tải…</p>}
      {plans && (
        <div className="overflow-x-auto rounded-lg border border-token">
          <table className="w-full text-left text-sm">
            <thead className="text-meta">
              <tr>
                <th className="p-2">Tên</th><th className="p-2">Khoá</th><th className="p-2">Phạm vi</th>
                <th className="p-2">Công khai</th><th className="p-2">Đang bán</th><th className="p-2">Thuê bao hiệu lực</th><th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <PlanRowView
                  key={p.key}
                  plan={p}
                  open={openKey === p.key}
                  onToggle={() => setOpenKey(openKey === p.key ? null : p.key)}
                  onSaved={load}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PlanRowView({ plan, open, onToggle, onSaved }: { plan: PlanRow; open: boolean; onToggle: () => void; onSaved: () => Promise<void> }) {
  return (
    <>
      <tr className="border-t border-token">
        <td className="p-2 font-medium">{plan.name}</td>
        <td className="p-2"><code className="font-mono text-xs">{plan.key}</code></td>
        <td className="p-2">{plan.scope === "individual" ? "Cá nhân" : "Tổ chức"}</td>
        <td className="p-2">{plan.isPublic ? "Có" : "Không"}</td>
        <td className="p-2"><StatusBadge tone={plan.active ? "success" : "neutral"}>{plan.active ? "Đang bán" : "Ngừng bán"}</StatusBadge></td>
        <td className="p-2">{plan.activeSubscriptions}</td>
        <td className="p-2 text-right"><button type="button" className="link text-sm" onClick={onToggle}>{open ? "Đóng" : "Sửa"}</button></td>
      </tr>
      {open && (
        <tr className="border-t border-token bg-[rgb(var(--surface-muted))]">
          <td colSpan={7} className="p-4"><PlanForm plan={plan} onSaved={onSaved} /></td>
        </tr>
      )}
    </>
  );
}

function PlanForm({ plan, onSaved }: { plan: PlanRow; onSaved: () => Promise<void> }) {
  const [limits, setLimits] = useState<Record<string, string>>(() =>
    Object.fromEntries(PLAN_LIMIT_KEYS.map((k) => [k, typeof plan.entitlements[k] === "number" ? String(plan.entitlements[k]) : ""])),
  );
  const [bools, setBools] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PLAN_BOOLEAN_KEYS.map((k) => [k, plan.entitlements[k] === true])),
  );
  const price = (period: "month" | "year") => plan.prices.find((p) => p.period === period);
  const [prices, setPrices] = useState({
    month: price("month") ? String(price("month")!.amountVnd) : "",
    year: price("year") ? String(price("year")!.amountVnd) : "",
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    // Gửi nguyên đối tượng quyền lợi: ô số trống = không đặt khoá đó; công tắc luôn ghi true/false.
    const entitlements: Record<string, number | boolean> = {};
    for (const k of PLAN_LIMIT_KEYS) {
      const raw = limits[k]!.trim();
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        setBusy(false);
        setMsg({ ok: false, text: planErrorText("invalid_value_type") });
        return;
      }
      entitlements[k] = n;
    }
    for (const k of PLAN_BOOLEAN_KEYS) entitlements[k] = bools[k]!;
    try {
      const r = await fetch(apiUrl(`/api/admin/plans/${encodeURIComponent(plan.key)}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entitlements }),
      });
      if (!r.ok) {
        setMsg({ ok: false, text: planErrorText((await r.json().catch(() => ({}))).error) });
        return;
      }
      if (plan.scope === "individual") {
        for (const period of ["month", "year"] as const) {
          const raw = prices[period].trim();
          if (raw === "" || Number(raw) === price(period)?.amountVnd) continue;
          const pr = await fetch(apiUrl(`/api/admin/plans/${encodeURIComponent(plan.key)}/prices`), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ period, amountVnd: Number(raw), active: true }),
          });
          if (!pr.ok) {
            setMsg({ ok: false, text: planErrorText((await pr.json().catch(() => ({}))).error) });
            return;
          }
        }
      }
      setMsg({ ok: true, text: "Đã lưu." });
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        {PLAN_LIMIT_KEYS.map((k) => (
          <label key={k} className="block text-sm">
            <span className="font-medium">{LIMIT_LABELS[k] ?? k}</span>
            <input
              type="number" min={0} inputMode="numeric"
              className="input mt-1 w-full"
              value={limits[k]}
              placeholder="Không đặt"
              onChange={(e) => setLimits({ ...limits, [k]: e.target.value })}
            />
            <span className="text-caption text-faint">
              Tối đa {TECH_CEILINGS[k]?.toLocaleString("vi-VN")} · để trống = không đặt
              {LIMIT_HINTS[k] && (!LIMIT_HINTS[k]!.orgOnly || plan.scope === "organization") ? ` · ${LIMIT_HINTS[k]!.text}` : ""}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        {PLAN_BOOLEAN_KEYS.map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={bools[k]} onChange={(e) => setBools({ ...bools, [k]: e.target.checked })} />
            {BOOLEAN_LABELS[k] ?? k}
          </label>
        ))}
      </div>
      {plan.scope === "individual" && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(["month", "year"] as const).map((period) => (
            <label key={period} className="block text-sm">
              <span className="font-medium">Giá theo {period === "month" ? "tháng" : "năm"} (đ)</span>
              <input type="number" min={1} className="input mt-1 w-full" value={prices[period]} placeholder="Chưa có giá"
                onChange={(e) => setPrices({ ...prices, [period]: e.target.value })} />
            </label>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>{busy ? "Đang lưu…" : "Lưu"}</button>
        {msg && <span className={msg.ok ? "text-sm text-success-700" : "text-sm text-danger-700"} role="status">{msg.text}</span>}
      </div>
    </div>
  );
}
