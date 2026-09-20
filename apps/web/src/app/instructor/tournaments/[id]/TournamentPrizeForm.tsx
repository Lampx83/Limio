"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { tournamentErrorMessage } from "@/lib/tournamentText";
import {
  PRIZE_PRESETS,
  buildPrizePayload,
  percentsFromDistribution,
  prizeRows,
  validatePrize,
} from "@/lib/tournamentPrize";

const MEDALS: Record<number, string> = { 1: "Hạng 1 (vàng)", 2: "Hạng 2 (bạc)", 3: "Hạng 3 (đồng)" };

export default function TournamentPrizeForm({
  tournamentId,
  prizeXp: initialXp,
  initialDistribution,
  teamSize,
  canEdit,
}: {
  tournamentId: string;
  prizeXp: number;
  initialDistribution: Record<string, number> | null;
  teamSize: number;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [xp, setXp] = useState(String(initialXp));
  const [pcts, setPcts] = useState<string[]>(() => {
    const p = percentsFromDistribution(initialDistribution);
    return p.length > 0 ? p : ["50", "30", "20"];
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const errors = validatePrize(xp, pcts);
  const xpNum = /^\d+$/.test(xp.trim()) ? Number(xp) : 0;
  const rows = prizeRows(xpNum, pcts);
  const total = Math.round(pcts.reduce((a, p) => a + (Number(p) || 0), 0) * 100) / 100;
  const hasPrize = xpNum > 0;
  const dirty = xp !== String(initialXp) || JSON.stringify(pcts) !== JSON.stringify(percentsFromDistribution(initialDistribution).length ? percentsFromDistribution(initialDistribution) : ["50", "30", "20"]);

  function touch() {
    setSaved(false);
    setSubmitError(null);
  }

  async function save() {
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPrizePayload(xp, pcts)),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSubmitError(tournamentErrorMessage(d, "Chưa lưu được. Vui lòng thử lại."));
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setSubmitError(tournamentErrorMessage({ error: "network_error" }));
    } finally {
      setBusy(false);
    }
  }

  const teamNote =
    teamSize > 1
      ? "Đấu trường theo đội: mỗi thành viên của đội nhận đủ số XP của hạng đó, không chia nhỏ."
      : "XP được cộng vào tài khoản người chơi khi đấu trường kết thúc.";

  // Chỉ xem
  if (!canEdit) {
    return (
      <div className="card">
        <h3 className="text-base font-semibold">Giải thưởng</h3>
        {!hasPrize ? (
          <p className="mt-2 text-sm text-muted">Đấu trường này không có XP thưởng.</p>
        ) : (
          <>
            <p className="mt-2 text-2xl font-bold">{xpNum.toLocaleString("vi-VN")} XP</p>
            <ul className="mt-3 divide-y divide-[rgb(var(--border))]">
              {rows.filter((r) => r.percent > 0).map((r) => (
                <li key={r.rank} className="flex items-center justify-between py-2 text-sm">
                  <span>{MEDALS[r.rank] ?? `Hạng ${r.rank}`}</span>
                  <span className="font-medium">{r.xp.toLocaleString("vi-VN")} XP <span className="font-normal text-muted">({r.percent}%)</span></span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">{teamNote}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="card space-y-5">
      <header className="border-b border-token pb-3">
        <h3 className="text-base font-semibold">Giải thưởng</h3>
        <p className="mt-1 text-sm text-muted">Đặt tổng XP thưởng rồi chia theo hạng. {teamNote}</p>
      </header>

      <div className="max-w-[260px]">
        <label htmlFor="prize-xp" className="mb-1.5 block text-sm font-medium">Tổng XP thưởng</label>
        <input
          id="prize-xp"
          type="number"
          min={0}
          value={xp}
          onChange={(e) => { setXp(e.target.value); touch(); }}
          className="input w-full"
        />
        {errors.prizeXp ? (
          <p className="mt-1.5 text-sm text-danger-600">{errors.prizeXp}</p>
        ) : (
          <p className="mt-1.5 text-xs text-muted">Đặt 0 nếu không có thưởng.</p>
        )}
      </div>

      {hasPrize && !errors.prizeXp && (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium">Chia theo hạng</p>
            <div className="flex flex-wrap gap-1.5">
              {PRIZE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setPcts(p.percents.map(String)); touch(); }}
                  className="rounded-full border border-token bg-[rgb(var(--surface))] px-3 py-1.5 text-sm transition hover:border-brand-400"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <ul className="space-y-2">
            {pcts.map((pct, i) => (
              <li key={i} className="flex flex-wrap items-center gap-3">
                <span className="w-32 shrink-0 text-sm font-medium">{MEDALS[i + 1] ?? `Hạng ${i + 1}`}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pct}
                  aria-label={`Tỷ lệ phần trăm cho hạng ${i + 1}`}
                  onChange={(e) => { setPcts((prev) => prev.map((p, x) => (x === i ? e.target.value : p))); touch(); }}
                  className="input w-24"
                />
                <span className="text-sm text-muted">%</span>
                <span className="text-xs text-muted">≈ {rows[i]?.xp.toLocaleString("vi-VN")} XP{teamSize > 1 ? " mỗi người" : ""}</span>
                <button
                  type="button"
                  aria-label={`Xoá hạng ${i + 1}`}
                  disabled={pcts.length === 1}
                  onClick={() => { setPcts((prev) => prev.filter((_, x) => x !== i)); touch(); }}
                  className="ml-auto rounded p-1.5 text-muted hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-token pt-3">
            <button type="button" onClick={() => { setPcts((prev) => [...prev, "0"]); touch(); }} className="btn-secondary btn-sm inline-flex items-center gap-1.5">
              <Plus size={14} /> Thêm hạng
            </button>
            <span className={`text-sm font-semibold ${total === 100 ? "text-success-600" : "text-danger-600"}`}>Tổng: {total}%</span>
          </div>
          {errors.distribution && <p className="text-sm text-danger-600">{errors.distribution}</p>}
        </div>
      )}

      {submitError && <p className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">{submitError}</p>}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-token pt-4">
        {saved && !dirty && <span className="mr-auto text-sm text-success-600">Đã lưu</span>}
        <button type="button" onClick={save} disabled={busy || !dirty || Object.keys(errors).length > 0} className="btn-primary">
          {busy ? "Đang lưu…" : "Lưu giải thưởng"}
        </button>
      </div>
    </div>
  );
}
