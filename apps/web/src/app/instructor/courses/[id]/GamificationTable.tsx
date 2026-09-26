"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Flame } from "lucide-react";
import BadgeIcon from "@/components/ui/BadgeIcon";

export interface GamificationRowDto {
  userId: string;
  displayName: string;
  email: string;
  sectionName: string | null;
  xp: number;
  level: number;
  currentStreak: number;
  badges: {
    code: string;
    name: string;
    description: string;
    category: string;
    earnedAt: string;
  }[];
  leaderboardOptOut: boolean;
}

type SortKey = "displayName" | "sectionName" | "xp" | "level" | "currentStreak" | "badges";

interface XpTx {
  amount: number;
  reason: string;
  occurredAt: string;
}

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "displayName", label: "Học viên", numeric: false },
  { key: "sectionName", label: "Lớp", numeric: false },
  { key: "xp", label: "XP", numeric: true },
  { key: "level", label: "Level", numeric: true },
  { key: "currentStreak", label: "Streak", numeric: true },
  { key: "badges", label: "Badge", numeric: true },
];

function sortValue(r: GamificationRowDto, key: SortKey): string | number {
  if (key === "badges") return r.badges.length;
  return r[key] ?? "";
}

const dtf = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  dateStyle: "short",
  timeStyle: "short",
});

export default function GamificationTable({
  courseId,
  rows,
}: {
  courseId: string;
  rows: GamificationRowDto[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("xp");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [openId, setOpenId] = useState<string | null>(null);
  const [tx, setTx] = useState<Record<string, XpTx[] | "loading" | "error">>({});

  const sorted = [...rows].sort((a, b) => {
    const va = sortValue(a, sortKey);
    const vb = sortValue(b, sortKey);
    const cmp =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb), "vi");
    return dir === "asc" ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setDir(key === "displayName" || key === "sectionName" ? "asc" : "desc");
    }
  }

  async function toggleRow(userId: string) {
    if (openId === userId) {
      setOpenId(null);
      return;
    }
    setOpenId(userId);
    if (tx[userId] && tx[userId] !== "error") return;
    setTx((s) => ({ ...s, [userId]: "loading" }));
    try {
      const res = await fetch(
        `/api/instructor/courses/${courseId}/gamification/xp?userId=${encodeURIComponent(userId)}`,
      );
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { transactions: XpTx[] };
      setTx((s) => ({ ...s, [userId]: data.transactions }));
    } catch {
      setTx((s) => ({ ...s, [userId]: "error" }));
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-token">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-[rgb(var(--surface-muted))] text-left text-xs text-muted">
          <tr>
            <th className="w-8 px-2 py-2" aria-hidden />
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={
                  sortKey === c.key
                    ? dir === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
                className={`px-3 py-2 font-medium ${c.numeric ? "text-right" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => toggleSort(c.key)}
                  className="inline-flex items-center gap-1 hover:text-default"
                >
                  {c.label}
                  {sortKey === c.key && (
                    <span aria-hidden>{dir === "asc" ? "▲" : "▼"}</span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const open = openId === r.userId;
            const detail = tx[r.userId];
            return (
              <Fragment key={r.userId}>
                <tr className="border-t border-token hover:bg-[rgb(var(--surface-muted))]">
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => toggleRow(r.userId)}
                      aria-expanded={open}
                      aria-label={`Chi tiết ${r.displayName}`}
                      className="text-muted hover:text-default"
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4" aria-hidden />
                      ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.displayName}</div>
                    <div className="text-xs text-faint">{r.email}</div>
                    {r.badges.length > 0 && (
                      <ul
                        aria-label={`Badge của ${r.displayName}`}
                        className="mt-1.5 flex max-w-[300px] gap-1 overflow-x-auto pb-1"
                      >
                        {r.badges.map((b) => (
                          <li
                            key={b.code}
                            title={`${b.name} — ${b.description}`}
                            className="shrink-0"
                          >
                            <BadgeIcon code={b.code} className="h-14 w-14" />
                            <span className="sr-only">{b.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.leaderboardOptOut && (
                      <span className="chip mt-1 text-xs">Ẩn khỏi BXH</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted">{r.sectionName ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.xp}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.level}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.currentStreak > 0 ? (
                      <span className="inline-flex items-center justify-end gap-1">
                        <Flame className="h-4 w-4 text-accent-600" aria-hidden />
                        {r.currentStreak}
                      </span>
                    ) : (
                      "0"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.badges.length}</td>
                </tr>
                {open && (
                  <tr className="border-t border-token bg-[rgb(var(--surface-muted))]">
                    <td />
                    <td colSpan={COLUMNS.length} className="px-3 py-3">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="text-xs font-semibold text-muted">
                            Badge trong khoá này
                          </h4>
                          {r.badges.length === 0 ? (
                            <p className="mt-1 text-sm text-faint">Chưa có badge.</p>
                          ) : (
                            <ul className="mt-1 space-y-2 text-sm">
                              {r.badges.map((b) => (
                                <li key={b.code} className="flex justify-between gap-3">
                                  <span className="min-w-0">
                                    <span className="inline-flex items-center gap-1.5 font-medium">
                                      <BadgeIcon code={b.code} className="h-12 w-12" />
                                      {b.name}
                                    </span>
                                    <span className="chip ml-2 text-xs">{b.category}</span>
                                    <span className="block text-xs text-muted">
                                      {b.description}
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-xs text-faint">
                                    {dtf.format(new Date(b.earnedAt))}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-muted">
                            20 giao dịch XP gần nhất
                          </h4>
                          {detail === "loading" || detail === undefined ? (
                            <p className="mt-1 text-sm text-faint">Đang tải…</p>
                          ) : detail === "error" ? (
                            <p className="mt-1 text-sm text-danger-700">
                              Không tải được. Đóng và mở lại dòng này để thử lại.
                            </p>
                          ) : detail.length === 0 ? (
                            <p className="mt-1 text-sm text-faint">Chưa có giao dịch.</p>
                          ) : (
                            <ul className="mt-1 space-y-1 text-sm">
                              {detail.map((t, i) => (
                                <li key={i} className="flex justify-between gap-3">
                                  <span>
                                    <span className="tabular-nums font-medium">
                                      {t.amount > 0 ? `+${t.amount}` : t.amount}
                                    </span>{" "}
                                    <span className="text-muted">{t.reason}</span>
                                  </span>
                                  <span className="text-xs text-faint">
                                    {dtf.format(new Date(t.occurredAt))}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
