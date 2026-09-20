"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";
import { useRouter } from "next/navigation";
import { Copy, LogOut, UserX, Crown, Users } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

const ERROR_LABEL: Record<string, string> = {
  team_solo_only: "Đấu trường này không phải team-based.",
  team_name_taken: "Tên đội đã có người dùng.",
  team_full: "Đội đã đủ người.",
  team_join_code_invalid: "Mã đội không hợp lệ.",
  already_registered: "Bạn đã đăng ký đấu trường này.",
  not_published: "Đấu trường chưa mở đăng ký.",
  ended: "Đấu trường đã kết thúc.",
  team_locked_after_start: "Đấu trường đã bắt đầu — không thể thay đổi đội.",
  team_not_captain: "Chỉ captain mới có quyền này.",
  validation_failed: "Dữ liệu không hợp lệ.",
  not_registered: "Bạn chưa đăng ký.",
};

type Member = {
  id: string;
  registeredAt: string;
  user: { id: string; displayName: string };
};

type MyTeam = {
  id: string;
  name: string;
  captainId: string;
  joinCode: string;
  members: Member[];
};

type Props = {
  tournamentId: string;
  teamSize: number;
  isLoggedIn: boolean;
  isEnded: boolean;
  isOpen: boolean; // status in {published, active}
  isLocked: boolean; // status === active — registration window closed
  currentUserId: string | null;
  myTeam: MyTeam | null;
};

export default function TournamentTeamPanel({
  tournamentId,
  teamSize,
  isLoggedIn,
  isEnded,
  isOpen,
  isLocked,
  currentUserId,
  myTeam,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (isEnded) {
    return (
      <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          🏁 Đấu trường đã kết thúc
        </p>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-5 text-center dark:border-amber-700 dark:from-amber-950/40 dark:to-orange-950/40">
        <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
          🎟️ Đăng nhập để lập / tham gia đội
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/tournaments/${tournamentId}/teams`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        router.refresh();
        setMode("none");
        setName("");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(ERROR_LABEL[body.error] ?? body.error ?? "Lỗi không xác định");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/tournaments/${tournamentId}/teams/join`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: code.trim().toUpperCase() }),
        },
      );
      if (res.ok) {
        router.refresh();
        setMode("none");
        setCode("");
      } else {
        const body = await res.json().catch(() => ({}));
        setError(ERROR_LABEL[body.error] ?? body.error ?? "Lỗi không xác định");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!confirm("Rời đội? Hành động này không thể hoàn tác.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/tournaments/${tournamentId}/teams/leave`),
        { method: "POST" },
      );
      if (res.ok) router.refresh();
      else {
        const body = await res.json().catch(() => ({}));
        setError(ERROR_LABEL[body.error] ?? body.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleKick(targetUserId: string, targetName: string) {
    if (!confirm(`Loại "${targetName}" khỏi đội?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        apiUrl(`/api/tournaments/${tournamentId}/teams/kick`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId }),
        },
      );
      if (res.ok) router.refresh();
      else {
        const body = await res.json().catch(() => ({}));
        setError(ERROR_LABEL[body.error] ?? body.error);
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!myTeam) return;
    // Bản cũ báo "đã copy" ngay cả khi writeText ném lỗi — hàm không await gì
    // cả nên lỗi thành unhandled rejection và giao diện vẫn hiện dấu tích.
    if (!(await copyText(myTeam.joinCode))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ─── State: user already on a team ───────────────────────────────────
  if (myTeam) {
    const isCaptain = myTeam.captainId === currentUserId;
    const underStaffed = myTeam.members.length < teamSize;
    return (
      <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 dark:border-emerald-700 dark:from-emerald-950/40 dark:to-teal-950/40">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-emerald-700 dark:text-emerald-400" />
          <p className="text-sm font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Đội của bạn
          </p>
        </div>
        <p className="mt-2 text-lg font-bold">{myTeam.name}</p>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs">
          <span className="text-emerald-700 dark:text-emerald-300">
            {myTeam.members.length}/{teamSize} thành viên
          </span>
          {underStaffed && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              Còn thiếu {teamSize - myTeam.members.length}
            </span>
          )}
        </div>

        {/* Members */}
        <ul className="mt-3 space-y-1.5">
          {myTeam.members.map((m) => {
            const memberIsCaptain = m.user.id === myTeam.captainId;
            const isMe = m.user.id === currentUserId;
            return (
              <li
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-white/60 px-2.5 py-1.5 text-sm dark:bg-black/20"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {memberIsCaptain && (
                    <Crown
                      size={12}
                      className="shrink-0 text-amber-500"
                      aria-label="Captain"
                    />
                  )}
                  <span className="truncate font-medium">
                    {m.user.displayName}
                    {isMe && (
                      <span className="ml-1 text-xs font-normal text-emerald-600">
                        (bạn)
                      </span>
                    )}
                  </span>
                </span>
                {isCaptain && !memberIsCaptain && !isLocked && (
                  <button
                    type="button"
                    onClick={() => handleKick(m.user.id, m.user.displayName)}
                    disabled={busy}
                    title="Loại khỏi đội"
                    className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <UserX size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        {/* Join code share — only show before tournament locks */}
        {!isLocked && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3 dark:border-emerald-800 dark:bg-slate-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Mã mời bạn vào đội
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <code className="text-xl font-bold tracking-[0.2em] text-emerald-800 dark:text-emerald-300">
                {myTeam.joinCode}
              </code>
              <button
                type="button"
                onClick={copyCode}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                <Copy size={12} />
                {copied ? "Đã sao chép" : "Sao chép"}
              </button>
            </div>
          </div>
        )}

        {!isLocked && (
          <button
            type="button"
            onClick={handleLeave}
            disabled={busy}
            className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:bg-slate-900 dark:hover:bg-rose-950/40"
          >
            <LogOut size={12} />
            Rời đội
          </button>
        )}
        {error && (
          <p className="mt-2 text-xs font-medium text-rose-600">⚠ {error}</p>
        )}
      </div>
    );
  }

  // ─── Not on a team yet ───────────────────────────────────────────────
  if (!isOpen) {
    return (
      <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          ⏳ Đấu trường chưa mở đăng ký
        </p>
      </div>
    );
  }
  if (isLocked) {
    return (
      <div className="rounded-2xl border border-slate-300 bg-slate-100 p-5 text-center dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          🔒 Đấu trường đã bắt đầu — không thể đăng ký mới
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 p-5 shadow-xl dark:border-amber-600 dark:from-rose-950/40 dark:via-orange-950/40 dark:to-amber-950/40">
      <p className="text-xs font-black uppercase tracking-widest text-rose-700 dark:text-orange-400">
        🔥 Sẵn sàng?
      </p>
      <p className="mt-1 text-sm font-bold">
        Đấu trường đội ({teamSize} người/đội)
      </p>

      {mode === "none" && (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => setMode("create")}
            className="w-full rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02]"
          >
            🚩 Tạo đội mới
          </button>
          <button
            type="button"
            onClick={() => setMode("join")}
            className="w-full rounded-xl border-2 border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-50 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-amber-950/40"
          >
            🎟️ Có mã đội? Tham gia
          </button>
        </div>
      )}

      {mode === "create" && (
        <form onSubmit={handleCreate} className="mt-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            placeholder="Tên đội (vd. Code Ninjas)"
            className="input text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary btn-sm flex-1"
            >
              {busy ? "..." : "Tạo & lấy mã mời"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("none");
                setError(null);
              }}
              className="btn-ghost btn-sm"
            >
              Huỷ
            </button>
          </div>
        </form>
      )}

      {mode === "join" && (
        <form onSubmit={handleJoin} className="mt-4 space-y-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            maxLength={8}
            placeholder="MÃ ĐỘI (vd. K7M2NP)"
            className="input text-center text-lg font-mono font-bold tracking-[0.3em]"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="btn-primary btn-sm flex-1"
            >
              {busy ? "..." : "Tham gia"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("none");
                setError(null);
              }}
              className="btn-ghost btn-sm"
            >
              Huỷ
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="mt-3 text-xs font-medium text-rose-600 dark:text-rose-400">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
