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
      <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-5 text-center">
        <p className="text-sm text-muted">Tournament đã kết thúc</p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-5 text-center">
        <p className="mb-3 text-sm text-muted">
          Đăng nhập để đăng ký tham gia tournament
        </p>
        <a
          href={`/signin?callbackUrl=/tournaments/${tournamentId}`}
          className="btn-primary btn-sm"
        >
          Đăng nhập để đăng ký
        </a>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="rounded-xl border border-success-100 bg-success-50 p-5 text-center">
        <p className="text-sm font-semibold text-success-700">
          ✓ Đã đăng ký tham gia
        </p>
        <p className="mt-1 text-xs text-faint">
          Chúc bạn thi đấu tốt!
        </p>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-5 text-center">
        <p className="text-sm text-muted">Tournament chưa mở đăng ký</p>
      </div>
    );
  }

  async function handleRegister() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/register`, {
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

  return (
    <div className="rounded-xl border border-token bg-[rgb(var(--surface))] p-5 text-center">
      <button
        onClick={handleRegister}
        disabled={loading}
        className="btn-primary w-full disabled:opacity-60"
      >
        {loading ? "Đang đăng ký..." : "Đăng ký tham gia"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
