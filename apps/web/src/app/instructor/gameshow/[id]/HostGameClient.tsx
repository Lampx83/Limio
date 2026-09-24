"use client";

import { normalizeGameTheme } from "@/lib/gameshow/themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Baloo_2 } from "next/font/google";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { AVATARS } from "@/lib/gameshow/avatars";
import { computeTeamStandings, emojiForColorKey, teamColorClasses } from "@/lib/gameshow/teams";
import type { TeamMeta } from "@/lib/gameshow/teams";
import type { LiveParticipant, TeamStanding } from "@/lib/gameshow/types";
import { useRankDeltas } from "@/lib/gameshow/useRankDeltas";
import { useScoreDeltas } from "@/lib/gameshow/useScoreDeltas";
import type { ScoreDelta } from "@/lib/gameshow/useScoreDeltas";
import { useFlipList } from "@/lib/gameshow/useFlipList";
import { useCountUp } from "@/lib/gameshow/useCountUp";
import { CircularTimer } from "@/components/gameshow/CircularTimer";
import { Podium } from "@/components/gameshow/Podium";
import { OptionCard, OPTION_LETTERS } from "@/components/gameshow/OptionCard";
import { RankBadge, initials, avatarGradient } from "@/components/gameshow/RankBadge";
import { BarChart3, ChevronUp, ChevronDown, Minus, Flame, Check, Trophy, Play, Users } from "lucide-react";

// Font bo tròn, vui mắt, có subset tiếng Việt — chỉ dùng cho tên người chơi
// trên màn host (chiếu lên máy chiếu nên cần to, dễ nhận, có cá tính).
const playerNameFont = Baloo_2({ subsets: ["vietnamese", "latin"], weight: ["700", "800"] });

const QRCode = dynamic(() => import("qrcode.react").then((mod) => mod.QRCodeSVG), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg bg-white p-3" style={{ width: 160, height: 160 }} />
  ),
});

type Status = "lobby" | "running" | "reveal" | "ended";

type QuestionOption = { id: string; label: string; isCorrect: boolean };
type Question = { id: string; type: string; prompt: string; options: QuestionOption[] };

type Snapshot = {
  id: string;
  code: string;
  status: Status;
  quizTitle: string;
  teamModeEnabled: boolean;
  teams: TeamMeta[];
  currentQuestionIndex: number;
  currentQuestionStartedAt: number | null;
  timeLimitMs: number;
  answeredCount: number;
  questions: Question[];
  participants: LiveParticipant[];
};

// Khoảng dừng để mọi người nhìn đáp án trước khi tự động sang câu kế.
const REVEAL_PAUSE_MS = 4000;
// Splash "Câu N" chớp qua trước khi hiện nội dung câu hỏi — thuần cosmetic,
// timer thật (currentQuestionStartedAt) vẫn chạy phía dưới song song.
const QUESTION_SPLASH_MS = 700;

export default function HostGameClient({ sessionId, theme }: { sessionId: string; theme?: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [teamsMeta, setTeamsMeta] = useState<TeamMeta[]>([]);
  const teamStandings = useMemo(
    () => computeTeamStandings(participants, teamsMeta),
    [participants, teamsMeta],
  );
  const [answeredCount, setAnsweredCount] = useState(0);
  // Ai đã nộp câu hiện tại — chỉ để tô chấm trạng thái sống trên bảng xếp
  // hạng (đang trả lời/đã nộp), reset mỗi khi bắt đầu câu mới.
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pinCopied, setPinCopied] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(false);
  const splashForIndex = useRef<number | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // Full-screen "arena" — ẩn sidebar giảng viên trong lúc host gameshow.
  useEffect(() => {
    document.body.classList.add("gameshow-immersive");
    return () => document.body.classList.remove("gameshow-immersive");
  }, []);

  const load = async () => {
    const r = await fetch(apiUrl(`/api/gameshow/sessions/${sessionId}`));
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    const j = (await r.json()) as Snapshot & { answeredParticipantIds?: string[] };
    setSnap(j);
    setParticipants(j.participants);
    setTeamsMeta(j.teams ?? []);
    setAnsweredCount(j.answeredCount);
    setAnsweredIds(new Set(j.answeredParticipantIds ?? []));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Resync khi tab host quay lại foreground — tự sửa nếu SSE bỏ lỡ event
  // lúc backgrounded (vd. giảng viên chuyển sang trình chiếu slide khác).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    const es = new EventSource(apiUrl(`/api/gameshow/sessions/${sessionId}/stream`));
    esRef.current = es;
    es.onmessage = (ev) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      const type = data.type as string;
      if (type === "participant.joined") {
        const p = data.participant as LiveParticipant;
        setParticipants((prev) =>
          prev.some((x) => x.participantId === p.participantId) ? prev : [...prev, p],
        );
      } else if (type === "participant.avatar_changed") {
        setParticipants((prev) =>
          prev.map((p) =>
            p.participantId === data.participantId
              ? { ...p, avatarKey: data.avatarKey as string }
              : p,
          ),
        );
      } else if (type === "participant.kicked") {
        setParticipants((prev) => prev.filter((p) => p.participantId !== data.participantId));
      } else if (type === "answer.received") {
        setAnsweredCount(data.answeredCount as number);
        setAnsweredIds((prev) => new Set(prev).add(data.participantId as string));
      } else if (type === "question.ended") {
        setParticipants(data.leaderboard as LiveParticipant[]);
        setSnap((s) => (s ? { ...s, status: "reveal" } : s));
      } else if (type === "leaderboard.updated") {
        setParticipants(data.leaderboard as LiveParticipant[]);
      } else if (type === "game.ended") {
        setParticipants(data.leaderboard as LiveParticipant[]);
        setSnap((s) => (s ? { ...s, status: "ended" } : s));
      }
    };
    return () => es.close();
  }, [sessionId]);

  // Splash "Câu N" — chớp mỗi khi bước sang 1 câu mới (running + index mới).
  useEffect(() => {
    if (!snap || snap.status !== "running") return;
    if (splashForIndex.current === snap.currentQuestionIndex) return;
    splashForIndex.current = snap.currentQuestionIndex;
    setShowSplash(true);
    const t = setTimeout(() => setShowSplash(false), QUESTION_SPLASH_MS);
    return () => clearTimeout(t);
  }, [snap?.status, snap?.currentQuestionIndex]);

  const call = useCallback(
    async (action: string) => {
      setBusy(true);
      setErr(null);
      try {
        const r = await fetch(apiUrl(`/api/gameshow/sessions/${sessionId}/${action}`), {
          method: "POST",
        });
        const j = (await r.json().catch(() => null)) as {
          error?: string;
          questionIndex?: number;
          ended?: boolean;
        } | null;
        if (!r.ok) {
          // 409 invalid_status — thường do timer tự động và click thủ công
          // đụng nhau (đã chuyển bước rồi). Không phải lỗi thật, bỏ qua.
          if (r.status !== 409) setErr(j?.error ?? `HTTP ${r.status}`);
          return;
        }
        // Optimistic local update cho hành động của chính host — không đợi SSE
        // round-trip. Phải khớp CHÍNH XÁC những gì server trả về (đặc biệt
        // "ended"), nếu không sẽ đua với event "game.ended" từ SSE và ghi đè
        // ngược "ended" -> "running" với currentQuestionIndex vượt quá mảng câu hỏi.
        if (action === "start") {
          setAnsweredCount(0);
          setAnsweredIds(new Set());
          setSnap((s) =>
            s
              ? {
                  ...s,
                  status: "running",
                  currentQuestionIndex: j?.questionIndex ?? 0,
                  currentQuestionStartedAt: Date.now(),
                }
              : s,
          );
        } else if (action === "next") {
          setAnsweredCount(0);
          setAnsweredIds(new Set());
          if (j?.ended) {
            setSnap((s) => (s ? { ...s, status: "ended" } : s));
          } else {
            setSnap((s) =>
              s
                ? {
                    ...s,
                    status: "running",
                    currentQuestionIndex: j?.questionIndex ?? s.currentQuestionIndex + 1,
                    currentQuestionStartedAt: Date.now(),
                  }
                : s,
            );
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [sessionId],
  );

  const onStart = useCallback(() => call("start"), [call]);
  const onReveal = useCallback(() => call("reveal"), [call]);
  const onNext = useCallback(() => call("next"), [call]);
  const onEnd = useCallback(() => call("end"), [call]);

  const onKick = useCallback(
    async (participantId: string) => {
      setKickingId(participantId);
      // Optimistic — không đợi round-trip, host cần thấy phản hồi ngay khi
      // click; SSE participant.kicked tới sau sẽ là no-op (đã filter rồi).
      setParticipants((prev) => prev.filter((p) => p.participantId !== participantId));
      try {
        await fetch(apiUrl(`/api/gameshow/sessions/${sessionId}/participants/${participantId}`), {
          method: "DELETE",
        });
      } finally {
        setKickingId(null);
      }
    },
    [sessionId],
  );

  const onCopyPin = useCallback(() => {
    if (!snap) return;
    navigator.clipboard?.writeText(snap.code).then(() => {
      setPinCopied(true);
      setTimeout(() => setPinCopied(false), 1500);
    });
  }, [snap]);

  if (!snap) {
    return (
      <div className="gs-host-bg flex min-h-screen items-center justify-center text-sm font-medium text-white/90">
        Đang tải...
      </div>
    );
  }

  // shareUrl lo tiền tố đường dẫn của production; ghép tay với origin thì
  // link và mã QR đều thiếu tiền tố → người quét vào 404.
  const joinUrl = shareUrl(`/play/${snap.code}`);
  const currentQuestion = snap.questions[snap.currentQuestionIndex];
  const sorted = [...participants].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div
      data-gs-theme={normalizeGameTheme(theme)}
      className="gs-host-bg min-h-screen overflow-hidden px-4 py-6 text-white sm:px-8"
    >
      <div className="gs-host-blob -left-24 -top-24 h-80 w-80 bg-cyan-300" aria-hidden="true" />
      <div className="gs-host-blob -right-20 top-1/3 h-96 w-96 bg-amber-300" aria-hidden="true" />
      <div className="gs-host-blob -bottom-24 left-1/4 h-80 w-80 bg-fuchsia-300" aria-hidden="true" />
      <div className="w-full">
        <div className="flex items-center justify-between gap-2">
          <h1 className="gs-glass flex min-w-0 items-center gap-2.5 rounded-full py-2 pl-3 pr-5 text-lg font-bold sm:text-xl">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5 flex-none text-amber-200 sm:h-6 sm:w-6"
              aria-hidden="true"
            >
              <path d="M7.5 4.5h9a6 6 0 0 1 5.94 6.85l-.82 5.4a3 3 0 0 1-5.4 1.22L15 15.5H9l-1.22 2.47a3 3 0 0 1-5.4-1.22l-.82-5.4A6 6 0 0 1 7.5 4.5Z" />
              <g fill="#111827" opacity="0.55">
                <path d="M7 8.25a.75.75 0 0 1 .75.75v1h1a.75.75 0 0 1 0 1.5h-1v1a.75.75 0 0 1-1.5 0v-1h-1a.75.75 0 0 1 0-1.5h1v-1A.75.75 0 0 1 7 8.25Z" />
                <circle cx="16" cy="9.5" r="1.15" />
                <circle cx="18.5" cy="12" r="1.15" />
              </g>
            </svg>
            <span className="truncate">{snap.quizTitle}</span>
          </h1>
          <div className="flex flex-none items-center gap-2">
            {snap.status === "lobby" && (
              <button
                onClick={onStart}
                disabled={busy || sorted.length === 0}
                style={{ ["--gs-btn-shadow" as string]: "#b45309" }}
                className={`gs-btn-3d inline-flex items-center gap-2 rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 px-6 py-3 text-base font-black text-indigo-950 disabled:opacity-40 sm:text-lg ${
                  sorted.length > 0 ? "gs-glow-pulse" : ""
                }`}
              >
                <Play className="h-5 w-5" fill="currentColor" aria-hidden="true" />
                BẮT ĐẦU ({sorted.length})
              </button>
            )}
            {snap.status !== "ended" && (
              <button
                onClick={() => {
                  if (window.confirm("Kết thúc phiên gameshow?")) onEnd();
                }}
                disabled={busy}
                className="gs-glass flex-none rounded-full px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/30"
              >
                Kết thúc sớm
              </button>
            )}
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-xl border border-white/30 bg-red-600/70 px-4 py-2.5 text-sm font-medium text-white backdrop-blur">
            {err}
          </div>
        )}

        {snap.status === "lobby" && (
          <LobbyView
            code={snap.code}
            joinUrl={joinUrl}
            participants={sorted}
            teamModeEnabled={snap.teamModeEnabled}
            teamStandings={teamStandings}
            onCopyPin={onCopyPin}
            pinCopied={pinCopied}
            onKick={onKick}
            kickingId={kickingId}
          />
        )}

        {(snap.status === "running" || snap.status === "reveal") && currentQuestion && (
          <div className="relative">
            {showSplash && (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                <span className="gs-splash-in rounded-3xl bg-gradient-to-br from-indigo-600 to-fuchsia-600 px-10 py-6 text-4xl font-black tracking-tight shadow-2xl ring-4 ring-white/40 sm:text-6xl">
                  Câu {snap.currentQuestionIndex + 1}
                </span>
              </div>
            )}
            <PlayView
              snap={snap}
              currentQuestion={currentQuestion}
              answeredCount={answeredCount}
              answeredIds={answeredIds}
              participants={sorted}
              teamStandings={teamStandings}
              busy={busy}
              onReveal={onReveal}
              onNext={onNext}
            />
          </div>
        )}

        {snap.status === "ended" && (
          <div className="gs-glass mt-6 rounded-3xl p-6 text-center sm:p-10">
            <h2 className="flex items-center justify-center gap-2 text-2xl font-black sm:text-3xl">
              <Trophy className="h-7 w-7 flex-none text-amber-300 sm:h-8 sm:w-8" aria-hidden="true" />
              Kết thúc!
            </h2>
            <div className="mt-8">
              <Podium
                teamModeEnabled={snap.teamModeEnabled}
                participants={sorted}
                teamStandings={teamStandings}
              />
            </div>
            <a
              href="/instructor/gameshow/new"
              className="gs-btn-3d mt-8 inline-block rounded-2xl bg-white px-6 py-3 text-sm font-bold text-fuchsia-700 hover:bg-white/90"
              style={{ ["--gs-btn-shadow" as string]: "#701a75" }}
            >
              ← Về danh sách Gameshow
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ avatarKey, size = "text-2xl" }: { avatarKey: string; size?: string }) {
  return <span className={size}>{AVATARS[avatarKey] ?? "🙂"}</span>;
}

// Tilt nhẹ, ổn định theo participantId (không random lại mỗi lần re-render).
function tiltForId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return (h % 5) - 2; // -2..2 độ
}

function LobbyView({
  code,
  joinUrl,
  participants,
  teamModeEnabled,
  teamStandings,
  onCopyPin,
  pinCopied,
  onKick,
  kickingId,
}: {
  code: string;
  joinUrl: string;
  participants: LiveParticipant[];
  teamModeEnabled: boolean;
  teamStandings: TeamStanding[];
  onCopyPin: () => void;
  pinCopied: boolean;
  onKick: (participantId: string) => void;
  kickingId: string | null;
}) {
  return (
    <div className="mt-6 space-y-4">
      {/* Thanh vào phòng — hướng dẫn | mã PIN + copy | QR, ngang hàng kiểu Kahoot */}
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-5 text-indigo-950 shadow-[0_20px_50px_-15px_rgb(60_10_100/0.6)] sm:flex-row sm:justify-center sm:gap-8 sm:p-6">
        <div className="text-center sm:text-left">
          <p className="text-xs font-medium text-slate-400">Học viên tham gia tại</p>
          <p className="max-w-[16rem] truncate text-sm font-semibold text-fuchsia-700">{joinUrl}</p>
          <p className="mt-0.5 text-xs text-slate-400">hoặc quét mã QR bên cạnh</p>
        </div>

        <div className="hidden h-14 w-px bg-slate-200 sm:block" />

        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Mã phòng
          </p>
          <button
            onClick={onCopyPin}
            title="Bấm để copy"
            className="gs-glow-pulse group relative rounded-2xl bg-gradient-to-br from-indigo-50 to-fuchsia-50 px-6 py-2 text-4xl font-black tracking-[0.2em] text-indigo-900 ring-1 ring-fuchsia-200 transition-transform hover:scale-105 sm:text-5xl"
          >
            {code}
            <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
              {pinCopied ? "✓" : "⧉"}
            </span>
          </button>
          {pinCopied && <span className="text-xs font-semibold text-emerald-600">Đã copy!</span>}
        </div>

        <div className="hidden h-14 w-px bg-slate-200 sm:block" />

        {joinUrl && (
          <div className="flex-none rounded-lg border border-slate-200 p-1.5">
            <QRCode value={joinUrl} size={96} />
          </div>
        )}
      </div>

      {/* "Màn hình" lớp học — hiện học viên vào real-time, giống chiếu lên máy chiếu */}
      <div className="gs-glass relative overflow-hidden rounded-3xl p-6 sm:p-10">
        <div className="flex justify-center">
          <span
            key={participants.length}
            className="gs-bounce-in inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-bold text-fuchsia-700 shadow-lg"
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            {participants.length} người sẵn sàng
          </span>
        </div>

        <p className="mt-3 text-center text-sm font-medium text-white/85">
          {participants.length === 0
            ? "Đang chờ học viên tham gia..."
            : "Học viên đã vào phòng — sẵn sàng khi bạn bấm Bắt đầu"}
        </p>

        {teamModeEnabled ? (
          <div className="mt-6 grid min-h-[6rem] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {teamStandings.map((t) => {
              const colors = teamColorClasses(t.colorKey);
              return (
                <div key={t.teamId} className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/25">
                  <p
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}
                  >
                    {emojiForColorKey(t.colorKey)} {t.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.members.map((m, i) => (
                      <span
                        key={m.participantId}
                        style={{ animationDelay: `${Math.min(i, 20) * 40}ms`, transform: `rotate(${tiltForId(m.participantId)}deg)` }}
                        className={`group/chip gs-pop-in relative flex items-center gap-2 rounded-full bg-white/25 px-3 py-1.5 text-2xl font-extrabold leading-none ${playerNameFont.className}`}
                      >
                        <Avatar avatarKey={m.avatarKey} size="text-2xl" />
                        {m.displayName}
                        <KickButton
                          participantId={m.participantId}
                          onKick={onKick}
                          busy={kickingId === m.participantId}
                        />
                      </span>
                    ))}
                    {t.members.length === 0 && (
                      <span className="text-xs text-white/60">Chưa có ai</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 flex min-h-[6rem] flex-wrap items-center justify-center gap-x-4 gap-y-5">
            {participants.map((p, i) => (
              <span
                key={p.participantId}
                style={{ animationDelay: `${Math.min(i, 20) * 40}ms`, transform: `rotate(${tiltForId(p.participantId)}deg)` }}
                className={`group/chip gs-pop-in relative flex items-center gap-3 rounded-full bg-white/25 px-5 py-2.5 text-3xl font-extrabold leading-none tracking-wide shadow-md transition-transform hover:scale-105 hover:rotate-0 sm:text-4xl ${playerNameFont.className}`}
              >
                <Avatar avatarKey={p.avatarKey} size="text-4xl" />
                <span>{p.displayName}</span>
                <KickButton
                  participantId={p.participantId}
                  onKick={onKick}
                  busy={kickingId === p.participantId}
                />
              </span>
            ))}
            {participants.length === 0 && (
              <span className="text-sm text-white/70">Chưa có ai tham gia...</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function KickButton({
  participantId,
  onKick,
  busy,
}: {
  participantId: string;
  onKick: (id: string) => void;
  busy: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (window.confirm("Đá học viên này khỏi phòng?")) onKick(participantId);
      }}
      disabled={busy}
      title="Đá khỏi phòng"
      className="ml-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-black/30 text-xs text-white/70 opacity-0 transition-opacity hover:bg-red-500 hover:text-white group-hover/chip:opacity-100 disabled:opacity-30"
    >
      ✕
    </button>
  );
}

function PlayView({
  snap,
  currentQuestion,
  answeredCount,
  answeredIds,
  participants,
  teamStandings,
  busy,
  onReveal,
  onNext,
}: {
  snap: Snapshot;
  currentQuestion: Question;
  answeredCount: number;
  answeredIds: Set<string>;
  participants: LiveParticipant[];
  teamStandings: TeamStanding[];
  busy: boolean;
  onReveal: () => void;
  onNext: () => void;
}) {
  const isRevealed = snap.status === "reveal";
  const [remainingMs, setRemainingMs] = useState(snap.timeLimitMs);
  // Guard theo câu hiện tại — tránh gọi reveal/next lặp lại khi effect
  // re-run do prop callback đổi reference hoặc parent re-render.
  const revealedForIndex = useRef<number | null>(null);
  const nextTriggeredForIndex = useRef<number | null>(null);

  // Đếm ngược + tự động "Xem đáp án" khi hết giờ — không cần đợi host bấm.
  useEffect(() => {
    if (snap.status !== "running" || snap.currentQuestionStartedAt == null) return;
    const startedAt = snap.currentQuestionStartedAt;
    const tick = () => {
      const left = Math.max(0, snap.timeLimitMs - (Date.now() - startedAt));
      setRemainingMs(left);
      if (left <= 0 && revealedForIndex.current !== snap.currentQuestionIndex) {
        revealedForIndex.current = snap.currentQuestionIndex;
        onReveal();
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [snap.status, snap.currentQuestionIndex, snap.currentQuestionStartedAt, snap.timeLimitMs, onReveal]);

  // Tự động sang câu kế (hoặc kết thúc) sau khi hiện đáp án được 1 lúc.
  useEffect(() => {
    if (snap.status !== "reveal") return;
    if (nextTriggeredForIndex.current === snap.currentQuestionIndex) return;
    const t = setTimeout(() => {
      nextTriggeredForIndex.current = snap.currentQuestionIndex;
      onNext();
    }, REVEAL_PAUSE_MS);
    return () => clearTimeout(t);
  }, [snap.status, snap.currentQuestionIndex, onNext]);

  return (
    <div className="mt-6 flex flex-col gap-4 lg:flex-row">
      <div className="flex-1 rounded-3xl bg-white/95 p-6 text-slate-900 shadow-[0_20px_50px_-15px_rgb(60_10_100/0.6)] ring-1 ring-white">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
            Câu {snap.currentQuestionIndex + 1}/{snap.questions.length}
          </span>
          {snap.status === "running" && (
            <CircularTimer remainingMs={remainingMs} totalMs={snap.timeLimitMs} size={72} strokeWidth={6} />
          )}
          <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-sm font-bold text-fuchsia-700">
            {answeredCount}/{participants.length} đã trả lời
          </span>
        </div>
        <h2 className="mt-4 text-center text-2xl font-black leading-snug sm:text-3xl">
          {currentQuestion.prompt}
        </h2>

        <div
          className={`mt-6 grid gap-4 ${currentQuestion.options.length <= 2 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {currentQuestion.options.map((o, i) => (
            <OptionCard
              key={o.id}
              letter={OPTION_LETTERS[i] ?? "?"}
              label={o.label}
              state={isRevealed ? (o.isCorrect ? "correct" : "dimmed") : "idle"}
              disabled
              tiltSign={i % 2 === 0 ? -1 : 1}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {snap.status === "running" && (
            <button
              onClick={onReveal}
              disabled={busy}
              style={{ ["--gs-btn-shadow" as string]: "#3730a3" }}
              className="gs-btn-3d rounded-2xl bg-gradient-to-b from-indigo-500 to-violet-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              Xem đáp án
            </button>
          )}
          {snap.status === "reveal" && (
            <button
              onClick={onNext}
              disabled={busy}
              style={{ ["--gs-btn-shadow" as string]: "#b45309" }}
              className="gs-btn-3d rounded-2xl bg-gradient-to-b from-yellow-300 to-amber-400 px-6 py-3 text-sm font-black text-indigo-950"
            >
              {snap.currentQuestionIndex + 1 >= snap.questions.length
                ? "Xem kết quả cuối"
                : "Câu tiếp theo"}
            </button>
          )}
        </div>
      </div>

      <LiveLeaderboard
        participants={participants}
        teamModeEnabled={snap.teamModeEnabled}
        teamStandings={teamStandings}
        answeredIds={answeredIds}
        answeredCount={answeredCount}
        isLive={snap.status === "running"}
      />
    </div>
  );
}

function RankDelta({ delta }: { delta: number | undefined }) {
  if (!delta) return <Minus className="h-3.5 w-3.5 flex-none text-white/50" aria-hidden="true" />;
  return delta > 0 ? (
    <span className="flex flex-none items-center gap-0.5 text-[10px] font-bold text-emerald-200">
      <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
      {delta}
    </span>
  ) : (
    <span className="flex flex-none items-center gap-0.5 text-[10px] font-bold text-rose-100">
      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      {Math.abs(delta)}
    </span>
  );
}


function LeaderboardRow({
  flipId,
  rank,
  name,
  score,
  colorKey,
  streak,
  delta,
  scoreDelta,
  liveStatus,
}: {
  flipId: string;
  rank: number;
  name: string;
  score: number;
  colorKey?: string;
  streak?: number;
  delta: number | undefined;
  scoreDelta: ScoreDelta | undefined;
  liveStatus?: "answering" | "submitted";
}) {
  const shownScore = useCountUp(score);

  return (
    <li
      data-flip-id={flipId}
      className={`relative flex items-center gap-2.5 rounded-xl border border-white/25 bg-white/20 px-3 py-2.5 text-sm shadow-sm backdrop-blur-md ${
        delta ? "gs-row-flash" : ""
      }`}
    >
      <RankBadge rank={rank} />
      <span
        className={`flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-black text-white ${
          colorKey ? teamColorClasses(colorKey).bg : ""
        }`}
        style={colorKey ? undefined : { background: avatarGradient(flipId) }}
      >
        {initials(name)}
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold text-white">{name}</span>

      {!!streak && streak >= 2 && (
        <span className="flex flex-none items-center gap-0.5 rounded-full bg-orange-500/40 px-1.5 py-0.5 text-[10px] font-bold text-orange-50">
          <Flame className="h-3 w-3" aria-hidden="true" />
          {streak}x
        </span>
      )}

      {liveStatus === "answering" && (
        <span
          className="gs-live-dot h-2 w-2 flex-none rounded-full bg-emerald-400"
          title="Đang trả lời"
        />
      )}
      {liveStatus === "submitted" && (
        <Check className="h-3.5 w-3.5 flex-none text-white" aria-label="Đã nộp" />
      )}

      <RankDelta delta={delta} />

      <span className="relative flex-none font-black tabular-nums text-yellow-200">
        {shownScore}
        {scoreDelta && (
          <span
            key={scoreDelta.nonce}
            className={`pointer-events-none absolute -top-1 right-0 translate-x-1/3 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${
              scoreDelta.delta >= 0 ? "gs-delta-rise bg-emerald-500/90" : "gs-delta-drop bg-rose-500/90"
            }`}
          >
            {scoreDelta.delta >= 0 ? `+${scoreDelta.delta}` : scoreDelta.delta}
          </span>
        )}
      </span>
    </li>
  );
}

function LiveLeaderboard({
  participants,
  teamModeEnabled,
  teamStandings,
  answeredIds,
  answeredCount,
  isLive,
}: {
  participants: LiveParticipant[];
  teamModeEnabled: boolean;
  teamStandings: TeamStanding[];
  answeredIds: Set<string>;
  answeredCount: number;
  isLive: boolean;
}) {
  const top5Participants = participants.slice(0, 5);
  const top5Teams = teamStandings.slice(0, 5);
  const orderedIds = teamModeEnabled
    ? top5Teams.map((t) => t.teamId)
    : top5Participants.map((p) => p.participantId);
  const deltas = useRankDeltas(orderedIds);
  const scoreDeltas = useScoreDeltas(
    teamModeEnabled
      ? top5Teams.map((t) => ({ id: t.teamId, score: t.avgScore }))
      : top5Participants.map((p) => ({ id: p.participantId, score: p.totalScore })),
  );
  const listRef = useRef<HTMLOListElement>(null);
  useFlipList(listRef, orderedIds);

  const total = teamModeEnabled ? teamStandings.length : participants.length;

  return (
    <aside className="gs-glass w-full flex-none rounded-3xl p-4 lg:w-80">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white">
          <BarChart3 className="h-4 w-4 flex-none text-amber-200" aria-hidden="true" />
          Bảng xếp hạng
        </h3>
        <span className="flex-none rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-bold text-white">
          {answeredCount}/{total}
        </span>
      </div>
      <ol ref={listRef} className="relative mt-3 space-y-1.5">
        {teamModeEnabled
          ? top5Teams.map((t, i) => (
              <LeaderboardRow
                key={t.teamId}
                flipId={t.teamId}
                rank={i + 1}
                name={t.name}
                score={t.avgScore}
                colorKey={t.colorKey}
                delta={deltas.get(t.teamId)}
                scoreDelta={scoreDeltas.get(t.teamId)}
              />
            ))
          : top5Participants.map((p, i) => (
              <LeaderboardRow
                key={p.participantId}
                flipId={p.participantId}
                rank={i + 1}
                name={p.displayName}
                score={p.totalScore}
                streak={p.streak}
                delta={deltas.get(p.participantId)}
                scoreDelta={scoreDeltas.get(p.participantId)}
                liveStatus={
                  isLive ? (answeredIds.has(p.participantId) ? "submitted" : "answering") : undefined
                }
              />
            ))}
        {total === 0 && <li className="text-xs text-white/70">Chưa có dữ liệu</li>}
      </ol>
    </aside>
  );
}
