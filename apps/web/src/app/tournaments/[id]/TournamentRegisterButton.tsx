"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

type Props = {
  tournamentId: string;
  isLoggedIn: boolean;
  isRegistered: boolean;
  isEnded: boolean;
  isOpen: boolean; // published or active
};

export default function TournamentRegisterButton({
  tournamentId,
  isLoggedIn,
  isRegistered,
  isEnded,
  isOpen,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(isRegistered);

  if (isEnded) {
    return (
      <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          🏁 Tournament đã kết thúc
        </p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center dark:border-amber-700 dark:from-amber-950/40 dark:to-orange-950/40">
        <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          🎟️ Đăng nhập để đăng ký tham gia
        </p>
        <a
          href={`/signin?callbackUrl=/tournaments/${tournamentId}`}
          className="inline-block w-full rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:scale-105"
        >
          Đăng nhập →
        </a>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 text-center dark:border-emerald-700 dark:from-emerald-950/40 dark:to-teal-950/40">
        <p className="text-2xl">🎉</p>
        <p className="mt-1 text-sm font-black text-emerald-700 dark:text-emerald-400">
          ĐÃ GHI DANH
        </p>
        <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400/80">
          Chúc bạn thi đấu tốt!
        </p>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          ⏳ Tournament chưa mở đăng ký
        </p>
      </div>
    );
  }

  async function handleRegister() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/register`), {
        method: "POST",
      });
      if (res.ok) {
        setRegistered(true);
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        if (body.error === "already_registered") {
          setRegistered(true);
        } else {
          setError(body.error ?? "Đăng ký thất bại. Vui lòng thử lại.");
        }
      }
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  // ── HOT REGISTER CTA ──────────────────────────────────────────────
  // Pulsing glow ring + gradient + shimmer. The button is THE primary action
  // of the page so it should grab attention without being annoying.
  return (
    <div className="relative">
      {/* Outer pulsing glow */}
      <div
        aria-hidden
        className="absolute -inset-1 animate-pulse rounded-2xl bg-gradient-to-r from-rose-600 via-orange-500 to-amber-400 opacity-60 blur-md"
      />
      <div className="relative rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 p-5 text-center shadow-2xl dark:border-amber-600 dark:from-rose-950/40 dark:via-orange-950/40 dark:to-amber-950/40">
        <p className="text-xs font-black uppercase tracking-widest text-rose-700 dark:text-orange-400">
          🔥 Sẵn sàng?
        </p>
        <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-200">
          Ghi danh tham gia tournament
        </p>
        <button
          onClick={handleRegister}
          disabled={loading}
          className="group relative mt-4 w-full overflow-hidden rounded-xl bg-gradient-to-r from-rose-600 via-red-500 to-orange-500 px-5 py-3.5 text-base font-black uppercase tracking-wide text-white shadow-xl ring-2 ring-rose-400/50 transition hover:scale-[1.02] hover:shadow-rose-500/50 hover:ring-rose-300 disabled:cursor-wait disabled:opacity-60"
        >
          {/* Shimmer overlay */}
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 group-hover:translate-x-full"
          />
          <span className="relative inline-flex items-center justify-center gap-2">
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Đang ghi danh...
              </>
            ) : (
              <>
                <span className="animate-pulse">🔥</span>
                Đăng ký ngay
                <span aria-hidden>→</span>
              </>
            )}
          </span>
        </button>
        {error && (
          <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
            ⚠ {error}
          </p>
        )}
      </div>
    </div>
  );
}
