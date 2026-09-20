"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/datetime";
import { tournamentErrorMessage } from "@/lib/tournamentText";
import { plainToRichHtml } from "@/lib/richText";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
});

interface Initial {
  title: string;
  description: string;
  startsAt: string; // ISO
  endsAt: string;   // ISO
  prizeXp: number;
  allowLateRegistration: boolean;
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
  const [description, setDescription] = useState(plainToRichHtml(initial.description));
  const [startsAt, setStartsAt] = useState(toDateTimeInputValue(initial.startsAt));
  const [endsAt, setEndsAt] = useState(toDateTimeInputValue(initial.endsAt));
  const [prizeXp, setPrizeXp] = useState(String(initial.prizeXp));
  const [allowLateRegistration, setAllowLateRegistration] = useState(
    initial.allowLateRegistration,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary btn-sm">
        Sửa thông tin
      </button>
    );
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        startsAt: fromDateTimeInputValue(startsAt),
        endsAt: fromDateTimeInputValue(endsAt),
        prizeXp: parseInt(prizeXp, 10) || 0,
        allowLateRegistration,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(tournamentErrorMessage(d, "Chưa lưu được. Vui lòng thử lại."));
    }
  }

  return (
    <form onSubmit={onSave} className="card space-y-4">
      <header className="border-b border-token pb-3">
        <h3 className="text-base font-semibold">Thông tin đấu trường</h3>
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
        <div className="mt-1.5">
          <RichTextEditor value={description} onChange={setDescription} />
        </div>
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
          XP thưởng
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
          Tổng XP chia cho những người đứng đầu. Chia theo hạng ở tab Giải thưởng.
        </p>
      </div>

      <div>
        <label className="flex items-start gap-2.5 rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3 hover:border-brand-300 cursor-pointer">
          <input
            type="checkbox"
            checked={allowLateRegistration}
            onChange={(e) => setAllowLateRegistration(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <div className="text-sm">
            <span className="font-medium">
              Cho phép đăng ký khi đấu trường đang diễn ra
            </span>
            <p className="mt-0.5 text-xs text-muted">
              Bật: người chơi vẫn vào được sau khi giải bắt đầu, đến lúc kết thúc.
              Tắt: khoá danh sách ngay khi giải bắt đầu.
            </p>
          </div>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-token pt-4">
        {error && (
          <span className="mr-auto text-sm text-danger-600">{error}</span>
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
