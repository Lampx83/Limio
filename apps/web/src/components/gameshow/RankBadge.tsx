"use client";

import { Crown, Medal } from "lucide-react";

// Icon hạng 1/2/3 dạng vector (Crown/Medal) + khung màu kim loại — thay hẳn
// 🥇🥈🥉 — dùng chung cho Leaderboard (HostGameClient) và Podium.
export function RankBadge({
  rank,
  size = "md",
}: {
  rank: number; // 1-indexed
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "lg" ? "h-11 w-11" : size === "md" ? "h-7 w-7" : "h-6 w-6";
  const iconDims = size === "lg" ? "h-6 w-6" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (rank === 1)
    return (
      <span
        className={`flex ${dims} flex-none items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-amber-950 ring-2 ring-amber-300/50`}
      >
        <Crown className={iconDims} aria-hidden="true" />
      </span>
    );
  if (rank === 2)
    return (
      <span
        className={`flex ${dims} flex-none items-center justify-center rounded-full bg-gradient-to-b from-slate-200 to-slate-400 text-slate-800 ring-2 ring-slate-300/40`}
      >
        <Medal className={iconDims} aria-hidden="true" />
      </span>
    );
  if (rank === 3)
    return (
      <span
        className={`flex ${dims} flex-none items-center justify-center rounded-full bg-gradient-to-b from-orange-300 to-orange-500 text-orange-950 ring-2 ring-orange-300/40`}
      >
        <Medal className={iconDims} aria-hidden="true" />
      </span>
    );
  return (
    <span
      className={`flex ${dims} flex-none items-center justify-center rounded-full bg-white/10 font-bold text-white/60 ${
        size === "lg" ? "text-base" : "text-xs"
      }`}
    >
      {rank}
    </span>
  );
}

// Ghép chữ cái đầu tên/đội thay avatar emoji — "Học viên A" -> "HA".
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Gradient ổn định theo id (không đổi giữa các lần render/reorder) — thay
// avatar emoji cho hàng/badge cá nhân.
export function avatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${hash}, 70%, 52%), hsl(${(hash + 45) % 360}, 70%, 40%))`;
}
