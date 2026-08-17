"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const RANK_LABELS: Record<number, string> = {
  1: "Hạng Vàng",
  2: "Hạng Bạc",
  3: "Hạng Đồng",
};

function toPercents(dist: Record<string, number> | null): string[] {
  if (!dist) return ["50", "30", "20"];
  const entries = Object.entries(dist).sort(([a], [b]) => Number(a) - Number(b));
  return entries.length > 0 ? entries.map(([, pct]) => String(pct)) : ["50", "30", "20"];
}

export default function TournamentPrizeForm({
  tournamentId,
  prizeXp,
  initialDistribution,
}: {
  tournamentId: string;
  prizeXp: number;
  initialDistribution: Record<string, number> | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pcts, setPcts] = useState<string[]>(toPercents(initialDistribution));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = pcts.reduce((sum, p) => sum + (Number(p) || 0), 0);
  const totalRounded = Math.round(total * 100) / 100;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="link text-sm">
        {initialDistribution ? "Sửa phân phối giải thưởng" : "Thiết lập phân phối giải thưởng"}
      </button>
    );
  }

  function updatePct(idx: number, value: string) {
    setPcts((prev) => prev.map((p, i) => (i === idx ? value : p)));
  }

  function addRank() {
    setPcts((prev) => [...prev, "0"]);
  }

  function removeRank(idx: number) {
    setPcts((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (totalRounded !== 100) {
      setError("Tổng tỷ lệ các hạng phải bằng 100%");
      return;
    }
    setBusy(true);
    setError(null);
    const distribution: Record<string, number> = {};
    pcts.forEach((p, idx) => {
      const pct = Number(p) || 0;
      if (pct > 0) distribution[String(idx + 1)] = pct;
    });
    const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prizeDistribution: distribution }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "save_failed");
    }
  }

  return (
    <form onSubmit={onSave} className="card space-y-4">
      <header className="border-b border-token pb-3">
        <h3 className="text-base font-semibold">Phân phối giải thưởng</h3>
        <p className="mt-1 text-xs text-faint">
          Chia {prizeXp.toLocaleString()} XP theo % cho từng hạng. Tổng các hạng
          phải bằng 100%, nếu không hệ thống sẽ không thể trao thưởng khi kết
          thúc giải.
        </p>
      </header>

      <div className="space-y-3">
        {pcts.map((pct, idx) => {
          const rank = idx + 1;
          const xp = Math.round(((Number(pct) || 0) / 100) * prizeXp);
          return (
            <div key={idx} className="flex items-center gap-3">
              <span className="flex w-32 shrink-0 items-center gap-1.5 text-sm font-medium">
                <span>{MEDALS[rank] ?? "🎖️"}</span>
                <span>{RANK_LABELS[rank] ?? `Hạng ${rank}`}</span>
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => updatePct(idx, e.target.value)}
                className="input w-24"
                aria-label={`Tỷ lệ % cho ${RANK_LABELS[rank] ?? `hạng ${rank}`}`}
              />
              <span className="text-sm text-muted">%</span>
              <span className="ml-1 text-xs text-faint">≈ {xp.toLocaleString()} XP</span>
              <button
                type="button"
                onClick={() => removeRank(idx)}
                className="ml-auto text-xs text-danger-600 hover:underline"
              >
                Xóa
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-token pt-3">
        <button type="button" onClick={addRank} className="btn-ghost text-sm">
          + Thêm hạng
        </button>
        <span
          className={`text-sm font-semibold ${
            totalRounded === 100 ? "text-emerald-600" : "text-danger-600"
          }`}
        >
          Tổng: {totalRounded}%
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-token pt-4">
        {error && (
          <span className="mr-auto text-sm text-danger-600">Lỗi: {error}</span>
        )}
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Hủy
        </button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}
