"use client";

import { useState } from "react";
import Link from "next/link";
import { Crown, Info, Trophy } from "lucide-react";
import type { BoardResponse, Period } from "@feedbackme/core-gamification";
import { UserAvatar } from "@/components/ui";

const TABS: { period: Period; label: string }[] = [
  { period: "weekly", label: "Tuần này" },
  { period: "all_time", label: "Toàn bộ" },
];

// Course-scoped leaderboard sidebar card dùng chung giữa /catalog/[slug] và
// /learn/[slug] — trước đây mỗi trang tự tính + tự render riêng (1 bên chỉ
// weekly, 1 bên chỉ all_time), khiến học viên thấy 2 con số khác nhau cho
// "cùng một bảng xếp hạng" mà không hiểu vì sao. Cả 2 kỳ được fetch sẵn ở
// server, component chỉ toggle hiển thị — không round-trip mạng khi đổi tab.
export default function CourseLeaderboardCard({
  courseId,
  weekly,
  allTime,
}: {
  courseId: string;
  weekly: BoardResponse;
  allTime: BoardResponse;
}) {
  const [period, setPeriod] = useState<Period>("weekly");
  const board = period === "weekly" ? weekly : allTime;
  const meInList = board.entries.some((e) => e.isYou);

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Bảng xếp hạng</h2>
        <Link
          href={`/leaderboard?scope=course&courseId=${courseId}&period=${period}`}
          className="link text-xs"
        >
          Đầy đủ →
        </Link>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <div
          className="inline-flex gap-0.5 rounded-full border border-token bg-[rgb(var(--surface-muted))] p-0.5"
          role="tablist"
          aria-label="Khoảng thời gian"
        >
          {TABS.map((t) => {
            const active = t.period === period;
            return (
              <button
                key={t.period}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(t.period)}
                className={
                  active
                    ? "rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 shadow-sm"
                    : "rounded-full px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:text-brand-700"
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <Link
          href="/xp-guide"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-token bg-[rgb(var(--surface-muted))] text-muted transition-colors hover:text-brand-700"
          aria-label="Cách tính điểm"
          title="Cách tính điểm"
        >
          <Info className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <p className="mt-2 text-xs text-faint">{board.totalParticipants} người tham gia</p>

      {board.selfOptedOut && (
        <p className="mt-2 text-xs text-faint">
          Bạn đã tắt BXH. Bật lại trong{" "}
          <Link href="/me/settings" className="link">
            cài đặt
          </Link>
          .
        </p>
      )}

      {board.entries.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2 py-4 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand-700">
            <Trophy className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-medium">
            {period === "weekly"
              ? "Chưa có ai ghi điểm tuần này"
              : "Chưa có học viên nào tích lũy XP"}
          </p>
          <p className="text-xs text-faint">
            {period === "weekly"
              ? "Hoàn thành một bài học để trở thành người dẫn đầu đầu tiên."
              : "Hãy là người đầu tiên xuất hiện trên bảng xếp hạng."}
          </p>
        </div>
      ) : (
        <ol className="mt-3 space-y-1.5 text-sm">
          {board.entries.map((e) => {
            const crown =
              e.rank === 1
                ? {
                    wrap: "h-11 w-11 bg-gradient-to-br from-yellow-300 via-amber-400 to-amber-600 ring-4 ring-amber-200/70 shadow-[0_0_18px_-2px_rgba(245,158,11,0.7)] animate-pulse",
                    icon: "h-6 w-6 text-white drop-shadow-md",
                    badge: "h-4 w-4 text-[10px] bg-amber-600 text-white ring-2 ring-white",
                  }
                : e.rank === 2
                  ? {
                      wrap: "h-9 w-9 bg-gradient-to-br from-slate-200 to-slate-400 ring-2 ring-slate-200 shadow-sm",
                      icon: "h-5 w-5 text-white drop-shadow-sm",
                      badge: "h-3.5 w-3.5 text-[9px] bg-white text-slate-700 ring-1 ring-slate-200",
                    }
                  : e.rank === 3
                    ? {
                        wrap: "h-7 w-7 bg-gradient-to-br from-orange-300 to-amber-700 ring-2 ring-orange-200 shadow-sm",
                        icon: "h-3.5 w-3.5 text-white drop-shadow-sm",
                        badge: "h-3 w-3 text-[8px] bg-white text-orange-800 ring-1 ring-orange-200",
                      }
                    : null;
            return (
              <li
                key={e.userId}
                className={`flex items-center gap-2 rounded-lg px-1.5 ${
                  e.rank === 1 ? "py-2" : "py-1"
                } ${e.isYou ? "bg-brand-soft font-semibold text-brand-700" : ""}`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center">
                  {crown ? (
                    <span
                      className={`relative flex items-center justify-center rounded-full ${crown.wrap}`}
                      title={`Hạng ${e.rank}`}
                    >
                      <Crown className={crown.icon} fill="currentColor" aria-hidden />
                      <span
                        className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full font-bold tabular-nums ${crown.badge}`}
                      >
                        {e.rank}
                      </span>
                    </span>
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--surface-muted))] text-[11px] font-bold tabular-nums text-faint">
                      {e.rank}
                    </span>
                  )}
                </span>
                <UserAvatar name={e.displayName} imageUrl={e.avatarUrl} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm">{e.displayName}</span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-brand-700">
                  {e.xp.toLocaleString("vi-VN")} XP
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {board.me && !meInList && !board.selfOptedOut && (
        <p className="mt-3 rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-xs">
          Bạn ở hạng #{board.me.rank} · {board.me.xp.toLocaleString("vi-VN")} XP
        </p>
      )}
    </div>
  );
}
