"use client";

import { useMemo, useState } from "react";
import { Crown, Lock, LockOpen } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { lmsErrorMessage } from "@/lib/lmsErrors";
import { toast } from "@/lib/toast";
import { EmptyState, KpiCard, UserAvatar } from "@/components/ui";

/** Bản JSON của CourseTeamsOverview (ngày giờ là chuỗi). */
export interface TeamsOverview {
  settings: { teamMaxSize: number | null; locked: boolean };
  teams: {
    id: string;
    name: string;
    joinCode: string;
    captainId: string | null;
    members: { userId: string; displayName: string; email: string; section: string | null }[];
  }[];
  unassigned: { id: string; displayName: string; email: string; section: string | null }[];
}

const NO_SECTION = "__none__";

function errorMessage(code: string | undefined, details: unknown, status: number): string {
  if (details === "team_max_size_out_of_range") return "Số người tối đa phải từ 1 đến 50.";
  if (code === "team_not_found") return "Không tìm thấy nhóm này — hãy tải lại trang.";
  if (code === "not_enrolled") return "Sinh viên này không còn ghi danh khoá học.";
  if (code === "not_in_team") return "Sinh viên này không còn ở nhóm đó — hãy tải lại trang.";
  return lmsErrorMessage(code ?? "server_error", status);
}

export default function TeamsClient({ courseId, initial }: { courseId: string; initial: TeamsOverview }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maxInput, setMaxInput] = useState(initial.settings.teamMaxSize?.toString() ?? "");
  const [section, setSection] = useState("all");

  const endpoint = apiUrl(`/api/instructor/courses/${courseId}/teams`);

  async function call(method: "PATCH" | "POST", body: unknown, okMsg?: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = errorMessage(d.error, d.details, res.status);
        setError(msg);
        toast.error(msg);
        return false;
      }
      setData(d as TeamsOverview);
      if (okMsg) toast.success(okMsg);
      return true;
    } catch {
      setError(lmsErrorMessage("network_error", 0));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const savedMax = data.settings.teamMaxSize?.toString() ?? "";
  const maxDirty = maxInput.trim() !== savedMax;

  async function saveMax(e: React.FormEvent) {
    e.preventDefault();
    const raw = maxInput.trim();
    const n = raw === "" ? null : Number(raw);
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 50)) {
      setError("Số người tối đa phải là số nguyên từ 1 đến 50, hoặc để trống.");
      return;
    }
    await call("PATCH", { teamMaxSize: n }, "Đã lưu số người tối đa");
  }

  async function toggleLock() {
    const next = !data.settings.locked;
    if (
      next &&
      !window.confirm("Khoá danh sách nhóm? Sinh viên sẽ không tự tạo, vào, rời nhóm hay đổi mã được nữa.")
    )
      return;
    await call("PATCH", { locked: next }, next ? "Đã khoá danh sách nhóm" : "Đã mở khoá danh sách nhóm");
  }

  async function onMemberAction(userId: string, displayName: string, teamId: string | null, action: string) {
    if (!action) return;
    if (action === "captain" && teamId) {
      await call("POST", { action: "captain", teamId, userId }, `${displayName} là trưởng nhóm`);
    } else if (action === "remove") {
      if (!window.confirm(`Gỡ ${displayName} khỏi nhóm?`)) return;
      await call("POST", { action: "move", userId, toTeamId: null }, `Đã gỡ ${displayName} khỏi nhóm`);
    } else if (action.startsWith("move:")) {
      await call("POST", { action: "move", userId, toTeamId: action.slice(5) }, `Đã chuyển ${displayName}`);
    }
  }

  // Lớp (section) có trong khoá — lấy từ thành viên nhóm + sinh viên chưa có nhóm.
  const sections = useMemo(() => {
    const names = new Set<string>();
    let hasNone = false;
    const people = [...data.teams.flatMap((t) => t.members), ...data.unassigned];
    for (const p of people) {
      if (p.section) names.add(p.section);
      else hasNone = true;
    }
    return { names: Array.from(names).sort((a, b) => a.localeCompare(b, "vi")), hasNone };
  }, [data]);

  const inSection = (s: string | null) =>
    section === "all" || (section === NO_SECTION ? s === null : s === section);
  // Nhóm có thể gồm sinh viên nhiều lớp: hiện nhóm nếu có ít nhất một người thuộc lớp đang lọc.
  const visibleTeams = data.teams.filter((t) => section === "all" || t.members.some((m) => inSection(m.section)));
  const visibleUnassigned = data.unassigned.filter((u) => inSection(u.section));

  const inTeamCount = data.teams.reduce((n, t) => n + t.members.length, 0);
  const max = data.settings.teamMaxSize;
  const locked = data.settings.locked;

  return (
    <div className="mt-6 space-y-6">
      {/* Cài đặt */}
      <section className="card space-y-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <form onSubmit={saveMax} className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="text-meta">Số người tối đa mỗi nhóm</span>
              <input
                type="number"
                min={1}
                max={50}
                inputMode="numeric"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                placeholder="Không giới hạn"
                className="input mt-1 w-40"
              />
            </label>
            <button type="submit" disabled={busy || !maxDirty} className="btn-secondary btn-sm">
              Lưu
            </button>
          </form>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={toggleLock}
              disabled={busy}
              className={`${locked ? "btn-secondary" : "btn-primary"} btn-sm inline-flex items-center gap-1.5`}
            >
              {locked ? <LockOpen className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
              {locked ? "Mở khoá" : "Khoá danh sách nhóm"}
            </button>
          </div>
        </div>
        <p className="text-caption">
          Để trống ô số người = không giới hạn. Đổi số người tối đa không gỡ ai khỏi nhóm đang đông hơn.
        </p>
        <p className={locked ? "banner-warning text-sm" : "banner-info text-sm"}>
          {locked
            ? "Danh sách nhóm đang khoá: sinh viên không tự tạo, vào, rời nhóm hay đổi mã được. Bạn vẫn chuyển, thêm, gỡ thành viên được."
            : "Danh sách nhóm đang mở: sinh viên tự tạo, vào, rời nhóm được. Khoá lại khi các nhóm đã ổn định."}
        </p>
        {error && (
          <p role="alert" className="banner-danger text-sm">
            {error}
          </p>
        )}
      </section>

      {/* Số liệu */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard label="Số nhóm" value={data.teams.length} tone="brand" />
        <KpiCard label="Sinh viên đã có nhóm" value={inTeamCount} tone="success" />
        <KpiCard
          label="Sinh viên chưa có nhóm"
          value={data.unassigned.length}
          tone={data.unassigned.length > 0 ? "warning" : "success"}
        />
      </div>

      {sections.names.length > 0 && (
        <label className="flex flex-wrap items-center gap-2">
          <span className="text-meta">Lọc theo lớp</span>
          <select value={section} onChange={(e) => setSection(e.target.value)} className="input w-auto max-w-[16rem]">
            <option value="all">Tất cả lớp</option>
            {sections.names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            {sections.hasNone && <option value={NO_SECTION}>Chưa xếp lớp</option>}
          </select>
        </label>
      )}

      {/* Danh sách nhóm */}
      <section>
        <h2 className="text-h3">
          Các nhóm <span className="text-meta font-normal">({visibleTeams.length})</span>
        </h2>
        {visibleTeams.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon="👥"
              title={data.teams.length === 0 ? "Chưa có nhóm nào" : "Không có nhóm nào ở lớp này"}
              description={
                data.teams.length === 0
                  ? "Khi sinh viên tạo nhóm ở trang khoá học, nhóm sẽ hiện ở đây."
                  : undefined
              }
            />
          </div>
        ) : (
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTeams.map((t) => {
              const over = max !== null && t.members.length > max;
              return (
                <li key={t.id} className="card space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-h4 truncate">{t.name}</p>
                      <p className="text-caption">
                        Mã nhóm <span className="font-mono font-semibold tracking-wider">{t.joinCode}</span>
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm tabular-nums ${over ? "font-semibold text-danger-600" : "text-muted"}`}
                      title={over ? "Nhóm đông hơn số người tối đa" : undefined}
                    >
                      {t.members.length}/{max ?? "∞"}
                    </span>
                  </div>
                  {t.members.length === 0 ? (
                    <p className="text-caption">Nhóm trống — giữ lại vì đã có bài nộp.</p>
                  ) : (
                    <ul className="space-y-2">
                      {t.members.map((m) => {
                        const isCaptain = t.captainId === m.userId;
                        return (
                          <li key={m.userId} className="flex items-center gap-2">
                            <UserAvatar name={m.displayName} size="sm" />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1 truncate text-sm font-medium">
                                <span className="truncate">{m.displayName}</span>
                                {isCaptain && (
                                  <Crown
                                    className="h-3.5 w-3.5 shrink-0 text-accent-600"
                                    aria-label="Trưởng nhóm"
                                  />
                                )}
                              </p>
                              <p className="text-caption truncate">{m.section ?? m.email}</p>
                            </div>
                            <select
                              aria-label={`Thao tác với ${m.displayName}`}
                              value=""
                              disabled={busy}
                              onChange={(e) => onMemberAction(m.userId, m.displayName, t.id, e.target.value)}
                              className="input h-8 w-auto max-w-[8.5rem] shrink-0 py-0 text-xs"
                            >
                              <option value="">Thao tác…</option>
                              {!isCaptain && <option value="captain">Đặt làm trưởng nhóm</option>}
                              <option value="remove">Gỡ khỏi nhóm</option>
                              {data.teams.length > 1 && (
                                <optgroup label="Chuyển sang nhóm">
                                  {data.teams
                                    .filter((o) => o.id !== t.id)
                                    .map((o) => (
                                      <option key={o.id} value={`move:${o.id}`}>
                                        {o.name}
                                      </option>
                                    ))}
                                </optgroup>
                              )}
                            </select>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Chưa có nhóm */}
      <section>
        <h2 className="text-h3">
          Chưa có nhóm <span className="text-meta font-normal">({visibleUnassigned.length})</span>
        </h2>
        {visibleUnassigned.length === 0 ? (
          <p className="text-meta mt-2">Mọi sinh viên{section !== "all" ? " ở lớp này" : ""} đều đã có nhóm.</p>
        ) : (
          <ul className="mt-3 divide-y divide-token rounded-2xl border border-token">
            {visibleUnassigned.map((u) => (
              <li key={u.id} className="flex items-center gap-2 px-3 py-2">
                <UserAvatar name={u.displayName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.displayName}</p>
                  <p className="text-caption truncate">
                    {u.email}
                    {u.section ? ` · ${u.section}` : ""}
                  </p>
                </div>
                {data.teams.length > 0 && (
                  <select
                    aria-label={`Thêm ${u.displayName} vào nhóm`}
                    value=""
                    disabled={busy}
                    onChange={(e) => onMemberAction(u.id, u.displayName, null, e.target.value)}
                    className="input h-8 w-auto max-w-[10rem] shrink-0 py-0 text-xs"
                  >
                    <option value="">Thêm vào nhóm…</option>
                    {data.teams.map((o) => (
                      <option key={o.id} value={`move:${o.id}`}>
                        {o.name}
                        {max !== null ? ` (${o.members.length}/${max})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
