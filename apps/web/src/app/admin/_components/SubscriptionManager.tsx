"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import DateTime from "@/components/ui/DateTime";
import StatusBadge, { type StatusTone } from "@/components/ui/StatusBadge";
import { formatDayKey } from "@/lib/datetime";
import { dayToEndsAt, dayToStartsAt, endsAtToLastDay } from "@/lib/planDates";
import { PLANS_DISABLED_TEXT, SUB_STATUS_LABEL, planErrorText, subStatus, type SubStatus } from "@/lib/planAdminUi";

type Target = { userId: string; organizationId?: never } | { organizationId: string; userId?: never };

interface Sub {
  id: string;
  planKey: string;
  planName: string;
  source: string;
  startsAt: string;
  endsAt: string;
  cancelledAt: string | null;
  note: string | null;
}
interface PlanOpt { key: string; name: string; scope: "individual" | "organization"; active: boolean }

const TONE: Record<SubStatus, StatusTone> = { active: "success", expired: "neutral", cancelled: "danger", upcoming: "info" };
const SOURCE_LABEL: Record<string, string> = { contract: "Hợp đồng", admin: "Quản trị", trial: "Dùng thử", order: "Mua", stripe: "Mua" };

export default function SubscriptionManager(props: Target) {
  const query = props.userId ? `userId=${encodeURIComponent(props.userId)}` : `organizationId=${encodeURIComponent(props.organizationId!)}`;
  const scope = props.userId ? "individual" : "organization";
  const [subs, setSubs] = useState<Sub[] | null>(null);
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [extendId, setExtendId] = useState<string | null>(null);
  const [extendDay, setExtendDay] = useState("");
  const [form, setForm] = useState({ planKey: "", from: "", to: "", note: "" });

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      fetch(apiUrl(`/api/admin/subscriptions?${query}`)),
      fetch(apiUrl("/api/admin/plans")),
    ]);
    if (a.ok) setSubs((await a.json()).subscriptions);
    if (b.ok) {
      const d = await b.json();
      setEnabled(d.plansEnabled);
      setPlans((d.plans as PlanOpt[]).filter((p) => p.scope === scope && p.active));
    }
  }, [query, scope]);
  useEffect(() => { void load(); }, [load]);

  async function call(url: string, method: string, body: unknown, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(apiUrl(url), { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) {
        setMsg({ ok: false, text: planErrorText((await r.json().catch(() => ({}))).error) });
        return false;
      }
      setMsg({ ok: true, text: okText });
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    const startsAt = dayToStartsAt(form.from);
    const endsAt = dayToEndsAt(form.to);
    if (!form.planKey || !startsAt || !endsAt) {
      setMsg({ ok: false, text: planErrorText(!form.planKey ? "invalid_body" : "invalid_dates") });
      return;
    }
    const ok = await call("/api/admin/subscriptions", "POST", {
      planKey: form.planKey, ...(props.userId ? { userId: props.userId } : { organizationId: props.organizationId }),
      startsAt, endsAt, source: props.userId ? "admin" : "contract", note: form.note || undefined,
    }, "Đã gán gói.");
    if (ok) setForm({ planKey: "", from: "", to: "", note: "" });
  }

  async function extend(id: string) {
    const endsAt = dayToEndsAt(extendDay);
    if (!endsAt) { setMsg({ ok: false, text: planErrorText("invalid_dates") }); return; }
    if (!window.confirm(`Gia hạn thuê bao đến hết ngày ${formatDayKey(extendDay)}?`)) return;
    if (await call(`/api/admin/subscriptions/${id}`, "PATCH", { action: "extend", endsAt }, "Đã gia hạn.")) setExtendId(null);
  }

  async function cancel(id: string) {
    if (!window.confirm("Huỷ thuê bao này? Quyền lợi của gói sẽ đóng ngay.")) return;
    await call(`/api/admin/subscriptions/${id}`, "PATCH", { action: "cancel" }, "Đã huỷ thuê bao.");
  }

  return (
    <div>
      {!enabled && <p className="banner-info mb-3">{PLANS_DISABLED_TEXT}</p>}
      {subs === null ? (
        <p className="text-meta">Đang tải…</p>
      ) : subs.length === 0 ? (
        <p className="text-sm text-muted">Chưa có thuê bao nào.</p>
      ) : (
        <ul className="space-y-2">
          {subs.map((s) => {
            const st = subStatus(s);
            return (
              <li key={s.id} className="rounded-lg border border-token p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.planName}</span>
                  <StatusBadge tone={TONE[st]}>{SUB_STATUS_LABEL[st]}</StatusBadge>
                  <span className="text-meta">{SOURCE_LABEL[s.source] ?? s.source}</span>
                </div>
                <p className="mt-1 text-meta">
                  Từ <DateTime value={s.startsAt} format="date" /> · đến hết {formatDayKey(endsAtToLastDay(s.endsAt))}
                  {s.note ? ` · ${s.note}` : ""}
                </p>
                {st !== "cancelled" && (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {extendId === s.id ? (
                      <>
                        <input type="date" className="input" aria-label="Đến hết ngày" value={extendDay} onChange={(e) => setExtendDay(e.target.value)} />
                        <button type="button" className="btn-primary" disabled={busy} onClick={() => extend(s.id)}>Gia hạn</button>
                        <button type="button" className="link" onClick={() => setExtendId(null)}>Bỏ qua</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="link" onClick={() => { setExtendId(s.id); setExtendDay(endsAtToLastDay(s.endsAt)); }}>Gia hạn</button>
                        <button type="button" className="link text-danger-700" disabled={busy} onClick={() => cancel(s.id)}>Huỷ</button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={assign} className="mt-4 grid gap-3 sm:grid-cols-2">
        <h3 className="text-sm font-semibold sm:col-span-2">Gán gói</h3>
        <label className="block text-sm">
          <span className="font-medium">Gói</span>
          <select className="input mt-1 w-full" value={form.planKey} onChange={(e) => setForm({ ...form, planKey: e.target.value })}>
            <option value="">Chọn gói…</option>
            {plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Ghi chú{props.organizationId ? " hợp đồng" : ""}</span>
          <input className="input mt-1 w-full" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Từ ngày</span>
          <input type="date" className="input mt-1 w-full" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Đến hết ngày</span>
          <input type="date" className="input mt-1 w-full" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={busy}>Gán gói</button>
          {msg && <span className={msg.ok ? "text-sm text-success-700" : "text-sm text-danger-700"} role="status">{msg.text}</span>}
        </div>
      </form>
    </div>
  );
}
