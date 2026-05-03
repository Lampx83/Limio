"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Initial {
  title: string;
  description: string;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  prizeXp: number;
}

function toDatetimeLocal(iso: string) {
  // Convert ISO to value compatible with datetime-local input (YYYY-MM-DDTHH:mm)
  return iso.slice(0, 16);
}

export default function TournamentMetaForm({
  tournamentId,
  initial,
}: {
  tournamentId: string;
  initial: Initial;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(initial.startsAt));
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(initial.endsAt));
  const [prizeXp, setPrizeXp] = useState(String(initial.prizeXp));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="link text-sm">
        Sửa thông tin tournament
      </button>
    );
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        prizeXp: parseInt(prizeXp, 10) || 0,
      }),
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
        <h3 className="text-base font-semibold">Thông tin tournament</h3>
      </header>

      <div>
        <label className="label" htmlFor="tm-title">
          Tiêu đề
        </label>
        <input
          id="tm-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
          className="input mt-1.5"
        />
      </div>

      <div>
        <label className="label" htmlFor="tm-desc">
          Mô tả
        </label>
        <textarea
          id="tm-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          className="textarea mt-1.5"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="tm-start">
            Bắt đầu
          </label>
          <input
            id="tm-start"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="input mt-1.5"
          />
        </div>
        <div>
          <label className="label" htmlFor="tm-end">
            Kết thúc
          </label>
          <input
            id="tm-end"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            className="input mt-1.5"
          />
        </div>
      </div>

      <div className="max-w-xs">
        <label className="label" htmlFor="tm-prize">
          Prize XP
        </label>
        <input
          id="tm-prize"
          type="number"
          min={0}
          value={prizeXp}
          onChange={(e) => setPrizeXp(e.target.value)}
          className="input mt-1.5"
        />
        <p className="mt-1 text-xs text-faint">
          Tổng XP phân phối cho top finishers.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-token pt-4">
        {error && (
          <span className="mr-auto text-sm text-danger-600">Lỗi: {error}</span>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost"
        >
          Hủy
        </button>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}
