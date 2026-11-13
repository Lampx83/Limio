"use client";

/**
 * Khối "Nhóm của tôi" trên trang khoá học (docs/group-submission-AC.md A1–A7, B2).
 * Học viên tự lập nhóm: trưởng nhóm tạo nhóm → nhận mã → gửi cho các bạn → các
 * bạn nhập mã. Mọi thao tác đi qua POST /api/courses/[id]/team, API trả lại
 * trạng thái nhóm mới nên khối tự cập nhật, không phải tải lại cả trang.
 */
import { useState } from "react";
import { Copy, Crown, LogOut, Pencil, RefreshCw, UserX, Users } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { copyText } from "@/lib/clipboard";
import { UserAvatar } from "@/components/ui";
import { COURSE_TEAM_ANCHOR } from "./courseTeamAnchor";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/dict";

type T = (key: MessageKey, params?: Record<string, string | number>) => string;

export type CourseTeamState = {
  settings: { teamMaxSize: number | null; locked: boolean };
  team: {
    id: string;
    name: string;
    joinCode: string;
    captainId: string | null;
    members: { userId: string; displayName: string; joinedAt: string }[];
  } | null;
};


type Action =
  | { action: "create"; name: string }
  | { action: "join"; code: string }
  | { action: "leave" }
  | { action: "regenerate" }
  | { action: "remove"; userId: string }
  | { action: "rename"; name: string };

function errorMessage(t: T, code: string | undefined, details: unknown, action: Action["action"]): string {
  switch (code) {
    case "join_code_invalid":
      return t("catalog.team.err.join_code_invalid");
    case "team_full": {
      const n = (details as { teamMaxSize?: number } | undefined)?.teamMaxSize;
      return n ? t("catalog.team.err.team_full_n", { n }) : t("catalog.team.err.team_full");
    }
    case "team_name_taken":
      return t("catalog.team.err.team_name_taken");
    case "teams_locked":
      return t("catalog.team.err.teams_locked");
    case "already_in_team":
      return t("catalog.team.err.already_in_team");
    case "not_captain":
      return t("catalog.team.err.not_captain");
    case "not_in_team":
      return action === "remove" ? t("catalog.team.err.not_in_team_remove") : t("catalog.team.err.not_in_team");
    case "not_enrolled":
      return t("catalog.team.err.not_enrolled");
    case "validation_failed":
      return action === "create" || action === "rename"
        ? t("catalog.team.err.name_length")
        : t("catalog.team.err.invalid");
    default:
      return t("catalog.team.err.generic");
  }
}

/** Lỗi cho thấy giao diện đang cũ hơn dữ liệu thật → tải lại trạng thái nhóm. */
const STALE_CODES = new Set(["already_in_team", "not_in_team", "teams_locked", "not_captain"]);

export default function CourseTeamPanel({
  courseId,
  currentUserId,
  initial,
}: {
  courseId: string;
  currentUserId: string;
  initial: CourseTeamState;
}) {
  const t = useT();
  const [state, setState] = useState<CourseTeamState>(initial);
  const [mode, setMode] = useState<"none" | "create" | "join">("none");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  const endpoint = apiUrl(`/api/courses/${courseId}/team`);

  async function refetch() {
    const res = await fetch(endpoint, { cache: "no-store" }).catch(() => null);
    if (res?.ok) setState((await res.json()) as CourseTeamState);
  }

  async function run(body: Action): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as
        | CourseTeamState
        | { error?: string; details?: unknown };
      if (res.ok) {
        setState(data as CourseTeamState);
        return true;
      }
      const err = data as { error?: string; details?: unknown };
      setError(errorMessage(t, err.error, err.details, body.action));
      if (err.error && STALE_CODES.has(err.error)) await refetch();
      return false;
    } catch {
      setError(t("catalog.team.err.network"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (await run({ action: "create", name: name.trim() })) {
      setMode("none");
      setName("");
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (await run({ action: "join", code: code.trim().toUpperCase() })) {
      setMode("none");
      setCode("");
    }
  }

  async function onLeave(isCaptain: boolean, othersLeft: number) {
    const msg =
      isCaptain && othersLeft > 0 ? t("catalog.team.confirmLeaveCaptain") : t("catalog.team.confirmLeave");
    if (!window.confirm(msg)) return;
    await run({ action: "leave" });
  }

  async function onRegenerate() {
    if (!window.confirm(t("catalog.team.confirmRegenerate"))) return;
    await run({ action: "regenerate" });
  }

  async function onRemove(userId: string, displayName: string) {
    if (!window.confirm(t("catalog.team.confirmRemove", { name: displayName }))) return;
    await run({ action: "remove", userId });
  }

  async function onRename(newName: string): Promise<boolean> {
    return run({ action: "rename", name: newName.trim() });
  }

  async function onCopy(joinCode: string) {
    const ok = await copyText(joinCode);
    setCopied(ok ? "ok" : "fail");
    setTimeout(() => setCopied(null), 2000);
  }

  const { settings, team } = state;
  const locked = settings.locked;

  return (
    <section id={COURSE_TEAM_ANCHOR} aria-labelledby="nhom-cua-toi-title" className="card scroll-mt-20">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 shrink-0 text-brand-600" aria-hidden />
        <h2 id="nhom-cua-toi-title" className="text-h4">
          {t("catalog.team.title")}
        </h2>
      </div>

      {team ? (
        <TeamView
          team={team}
          teamMaxSize={settings.teamMaxSize}
          locked={locked}
          currentUserId={currentUserId}
          busy={busy}
          copied={copied}
          onCopy={() => void onCopy(team.joinCode)}
          onRegenerate={() => void onRegenerate()}
          onRemove={(id, n) => void onRemove(id, n)}
          onLeave={(isCaptain, othersLeft) => void onLeave(isCaptain, othersLeft)}
          onRename={onRename}
        />
      ) : locked ? (
        <p className="banner-info mt-3">{t("catalog.team.lockedNoTeam")}</p>
      ) : (
        <div className="mt-2">
          <p className="text-meta">
            {t("catalog.team.intro")}
            {settings.teamMaxSize !== null && <> {t("catalog.team.maxSize", { n: settings.teamMaxSize })}</>}
          </p>

          {mode === "none" && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setMode("create");
                  setError(null);
                }}
                className="btn-primary"
              >
                {t("catalog.team.create")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("join");
                  setError(null);
                }}
                className="btn-secondary"
              >
                {t("catalog.team.joinByCode")}
              </button>
            </div>
          )}

          {mode === "create" && (
            <form onSubmit={onCreate} className="mt-4 space-y-3">
              <label className="block">
                <span className="label">{t("catalog.team.name")}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={60}
                  placeholder={t("catalog.team.namePlaceholder")}
                  className="input mt-1"
                  autoFocus
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy || !name.trim()} className="btn-primary btn-sm">
                  {busy ? t("catalog.team.creating") : t("catalog.team.createAndGet")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("none");
                    setError(null);
                  }}
                  className="btn-ghost btn-sm"
                >
                  {t("catalog.team.cancel")}
                </button>
              </div>
            </form>
          )}

          {mode === "join" && (
            <form onSubmit={onJoin} className="mt-4 space-y-3">
              <label className="block">
                <span className="label">{t("catalog.team.code")}</span>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                  required
                  minLength={6}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t("catalog.team.codePlaceholder")}
                  className="input mt-1 text-center font-mono text-lg font-bold tracking-[0.3em]"
                  autoFocus
                />
                <span className="help">{t("catalog.team.codeHelp")}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy || code.trim().length !== 6} className="btn-primary btn-sm">
                  {busy ? t("catalog.team.joining") : t("catalog.team.join")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("none");
                    setError(null);
                  }}
                  className="btn-ghost btn-sm"
                >
                  {t("catalog.team.cancel")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="banner-danger mt-3 px-0 py-0">
          {error}
        </p>
      )}
    </section>
  );
}

function TeamView({
  team,
  teamMaxSize,
  locked,
  currentUserId,
  busy,
  copied,
  onCopy,
  onRegenerate,
  onRemove,
  onLeave,
  onRename,
}: {
  team: NonNullable<CourseTeamState["team"]>;
  teamMaxSize: number | null;
  locked: boolean;
  currentUserId: string;
  busy: boolean;
  copied: "ok" | "fail" | null;
  onCopy: () => void;
  onRegenerate: () => void;
  onRemove: (userId: string, displayName: string) => void;
  onLeave: (isCaptain: boolean, othersLeft: number) => void;
  onRename: (name: string) => Promise<boolean>;
}) {
  const t = useT();
  const isCaptain = team.captainId === currentUserId;
  const count = team.members.length;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(team.name);

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (await onRename(draft)) setEditing(false);
  }

  return (
    <div className="mt-3">
      {editing ? (
        <form onSubmit={submitRename} className="space-y-2">
          <label className="block">
            <span className="label">{t("catalog.team.newName")}</span>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              required
              maxLength={60}
              className="input mt-1"
              autoFocus
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy || !draft.trim() || draft.trim() === team.name}
              className="btn-primary btn-sm"
            >
              {busy ? t("catalog.team.saving") : t("catalog.team.saveName")}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setDraft(team.name);
              }}
              className="btn-ghost btn-sm"
            >
              {t("catalog.team.cancel")}
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-body min-w-0 break-words font-semibold">
            {team.name}
            {isCaptain && !locked && (
              <button
                type="button"
                onClick={() => {
                  setDraft(team.name);
                  setEditing(true);
                }}
                disabled={busy}
                className="btn-ghost btn-sm ml-2 align-middle"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {t("catalog.team.rename")}
              </button>
            )}
          </p>
          <span className="text-meta tabular-nums">
            {teamMaxSize !== null
              ? t("catalog.team.peopleOfMax", { count, max: teamMaxSize })
              : t("catalog.team.people", { count })}
          </span>
        </div>
      )}

      {locked && (
        <p className="banner-info mt-3">{t("catalog.team.lockedBanner")}</p>
      )}

      <ul className="mt-3 space-y-1.5">
        {team.members.map((m) => {
          const memberIsCaptain = m.userId === team.captainId;
          const isMe = m.userId === currentUserId;
          return (
            <li
              key={m.userId}
              className="flex items-center gap-3 rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2"
            >
              <UserAvatar name={m.displayName} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {m.displayName}
                  {isMe && <span className="text-caption ml-1 font-normal">{t("catalog.team.you")}</span>}
                </span>
                {memberIsCaptain && (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <Crown className="h-3 w-3" fill="currentColor" aria-hidden />
                    {t("catalog.team.captain")}
                  </span>
                )}
              </span>
              {isCaptain && !isMe && !locked && (
                <button
                  type="button"
                  onClick={() => onRemove(m.userId, m.displayName)}
                  disabled={busy}
                  aria-label={t("catalog.team.removeAria", { name: m.displayName })}
                  title={t("catalog.team.removeTitle")}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-danger-600 hover:bg-danger-50 disabled:opacity-50"
                >
                  <UserX className="h-4 w-4" aria-hidden />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 rounded-lg border border-token p-3">
        <p className="text-caption">{t("catalog.team.codeLabel")}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <code className="font-mono text-xl font-bold tracking-[0.2em] text-brand-700 dark:text-brand-300">
            {team.joinCode}
          </code>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onCopy} className="btn-secondary btn-sm">
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied === "ok"
                ? t("catalog.team.copied")
                : copied === "fail"
                  ? t("catalog.team.copyFailed")
                  : t("catalog.team.copy")}
            </button>
            {isCaptain && !locked && (
              <button type="button" onClick={onRegenerate} disabled={busy} className="btn-ghost btn-sm">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                {t("catalog.team.regenerate")}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-caption mt-3">
        {t("catalog.team.submitHint")}
      </p>

      {!locked && (
        <button
          type="button"
          onClick={() => onLeave(isCaptain, count - 1)}
          disabled={busy}
          className="btn-ghost btn-sm mt-3 text-danger-600"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          {t("catalog.team.leave")}
        </button>
      )}
    </div>
  );
}
