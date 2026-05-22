"use client";

import { useMemo } from "react";
import { Download, Users } from "lucide-react";

export type Registration = {
  id: string;
  registeredAt: string;
  disqualifiedAt: string | null;
  teamId: string | null;
  user: {
    id: string;
    displayName: string;
    email: string;
  };
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN");
}

function csvEscape(s: string): string {
  // Wrap in quotes if contains comma/quote/newline; double existing quotes.
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function RegistrationsList({
  registrations,
  teamSize,
  tournamentTitle,
}: {
  registrations: Registration[];
  teamSize: number;
  tournamentTitle: string;
}) {
  const isTeamBased = teamSize > 1;

  // Group by teamId when team-based; otherwise a single "All" bucket.
  const groups = useMemo(() => {
    if (!isTeamBased) {
      return [{ teamId: null as string | null, items: registrations }];
    }
    const map = new Map<string, Registration[]>();
    const solo: Registration[] = [];
    for (const r of registrations) {
      if (!r.teamId) {
        solo.push(r);
        continue;
      }
      const arr = map.get(r.teamId) ?? [];
      arr.push(r);
      map.set(r.teamId, arr);
    }
    const teamGroups = [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([teamId, items]) => ({ teamId: teamId as string | null, items }));
    if (solo.length) teamGroups.push({ teamId: null, items: solo });
    return teamGroups;
  }, [registrations, isTeamBased]);

  const downloadCsv = () => {
    const headers = isTeamBased
      ? ["Đội", "Tên", "Email", "Đăng ký lúc", "Trạng thái"]
      : ["Tên", "Email", "Đăng ký lúc", "Trạng thái"];
    const rows = registrations.map((r) => {
      const status = r.disqualifiedAt
        ? `Bị loại (${formatDate(r.disqualifiedAt)})`
        : "Active";
      const base = [
        r.user.displayName,
        r.user.email,
        formatDate(r.registeredAt),
        status,
      ];
      return isTeamBased ? [r.teamId ?? "Solo", ...base] : base;
    });
    const csv = [headers, ...rows]
      .map((row) => row.map((c) => csvEscape(String(c))).join(","))
      .join("\n");
    // BOM giúp Excel mở UTF-8 đúng dấu tiếng Việt.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dang-ky-${tournamentTitle.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (registrations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-token py-12 text-center">
        <Users size={32} className="mx-auto text-faint" />
        <p className="mt-3 font-medium">Chưa có học viên nào đăng ký</p>
        <p className="mt-1 text-sm text-muted">
          {isTeamBased
            ? "Tournament theo đội sẽ hiện danh sách khi học viên đầu tiên đăng ký."
            : "Danh sách sẽ xuất hiện khi học viên đầu tiên đăng ký."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          <span className="font-semibold text-[rgb(var(--text))]">
            {registrations.length}
          </span>{" "}
          học viên
          {isTeamBased && (
            <>
              {" · "}
              <span className="font-semibold text-[rgb(var(--text))]">
                {groups.filter((g) => g.teamId).length}
              </span>{" "}
              đội
            </>
          )}
        </p>
        <button
          type="button"
          onClick={downloadCsv}
          className="btn-secondary btn-sm inline-flex items-center gap-1.5"
        >
          <Download size={14} />
          Tải CSV
        </button>
      </div>

      <div className="space-y-6">
        {groups.map((g) => (
          <div key={g.teamId ?? "_solo"}>
            {isTeamBased && (
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span className="rounded bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                  {g.teamId ? `Đội ${g.teamId}` : "Chưa phân đội"}
                </span>
                <span className="text-xs font-normal text-faint">
                  {g.items.length} người
                </span>
              </h3>
            )}
            <div className="overflow-hidden rounded-xl border border-token">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-token bg-[rgb(var(--surface-muted))] text-left text-xs text-muted">
                    <th className="px-3 py-2 font-medium">Học viên</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Đăng ký lúc</th>
                    <th className="px-3 py-2 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((r) => {
                    const initial = (r.user.displayName?.[0] ?? "?").toUpperCase();
                    return (
                      <tr
                        key={r.id}
                        className={`border-b border-token last:border-0 ${
                          r.disqualifiedAt ? "opacity-60" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                              {initial}
                            </span>
                            <span className="font-medium">
                              {r.user.displayName}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-muted">{r.user.email}</td>
                        <td className="px-3 py-2 text-faint">
                          {formatDate(r.registeredAt)}
                        </td>
                        <td className="px-3 py-2">
                          {r.disqualifiedAt ? (
                            <span className="inline-flex items-center rounded-full bg-danger-50 px-2 py-0.5 text-[11px] font-semibold text-danger-700">
                              Bị loại
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
