"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { AVATARS } from "@/lib/gameshow/avatars";
import { computeTeamStandings, emojiForColorKey, teamColorClasses } from "@/lib/gameshow/teams";
import type { TeamMeta } from "@/lib/gameshow/teams";

const QRCode = dynamic(() => import("qrcode.react").then((mod) => mod.QRCodeSVG), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg bg-white p-3" style={{ width: 160, height: 160 }} />
  ),
});

type Status = "lobby" | "running" | "reveal" | "ended";

type QuestionOption = { id: string; label: string; isCorrect: boolean };
type Question = { id: string; type: string; prompt: string; options: QuestionOption[] };
type LiveParticipant = {
  participantId: string;
  displayName: string;
  avatarKey: string;
  teamId: string | null;
  totalScore: number;
  streak: number;
};
type TeamStanding = {
  teamId: string;
  name: string;
  colorKey: string;
  avgScore: number;
  memberCount: number;
  members: LiveParticipant[];
};

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

export default function HostGameClient({ sessionId }: { sessionId: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [teamsMeta, setTeamsMeta] = useState<TeamMeta[]>([]);
  const teamStandings = useMemo(
    () => computeTeamStandings(participants, teamsMeta),
    [participants, teamsMeta],
  );
  const [answeredCount, setAnsweredCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
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
    const j = (await r.json()) as Snapshot;
    setSnap(j);
    setParticipants(j.participants);
    setTeamsMeta(j.teams ?? []);
    setAnsweredCount(j.answeredCount);
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
      } else if (type === "answer.received") {
        setAnsweredCount(data.answeredCount as number);
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

  if (!snap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-gray-950 to-pink-950 text-sm text-white/70">
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
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-gray-950 to-pink-950 px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-2">
          <h1 className="flex min-w-0 items-center gap-2 text-lg font-bold sm:text-xl">
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5 flex-none text-pink-300 sm:h-6 sm:w-6"
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
                disabled={busy}
                className="gs-glow-pulse rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2 text-sm font-bold text-indigo-950 shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
              >
                ▶ Bắt đầu ({sorted.length})
              </button>
            )}
            {snap.status !== "ended" && (
              <button
                onClick={() => {
                  if (window.confirm("Kết thúc phiên gameshow?")) onEnd();
                }}
                disabled={busy}
                className="flex-none rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/20"
              >
                Kết thúc sớm
              </button>
            )}
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-lg border border-red-400/40 bg-red-500/20 px-3 py-2 text-sm text-red-100">
            ⚠ {err}
          </div>
        )}

        {snap.status === "lobby" && (
          <LobbyView
            code={snap.code}
            joinUrl={joinUrl}
            participants={sorted}
            teamModeEnabled={snap.teamModeEnabled}
            teamStandings={teamStandings}
          />
        )}

        {(snap.status === "running" || snap.status === "reveal") && currentQuestion && (
          <PlayView
            snap={snap}
            currentQuestion={currentQuestion}
            answeredCount={answeredCount}
            participants={sorted}
            teamStandings={teamStandings}
            busy={busy}
            onReveal={onReveal}
            onNext={onNext}
          />
        )}

        {snap.status === "ended" && (
          <PodiumView
            participants={sorted}
            teamModeEnabled={snap.teamModeEnabled}
            teamStandings={teamStandings}
          />
        )}
      </div>
    </div>
  );
}

function Avatar({ avatarKey, size = "text-2xl" }: { avatarKey: string; size?: string }) {
  return <span className={size}>{AVATARS[avatarKey] ?? "🙂"}</span>;
}

function LobbyView({
  code,
  joinUrl,
  participants,
  teamModeEnabled,
  teamStandings,
}: {
  code: string;
  joinUrl: string;
  participants: LiveParticipant[];
  teamModeEnabled: boolean;
  teamStandings: TeamStanding[];
}) {
  return (
    <div className="mt-6 space-y-4">
      {/* Thanh vào phòng — hướng dẫn | mã PIN | QR, ngang hàng kiểu Kahoot */}
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-5 text-indigo-950 shadow-2xl sm:flex-row sm:justify-center sm:gap-6">
        <div className="text-center sm:text-left">
          <p className="text-xs font-medium text-slate-400">Học viên tham gia tại</p>
          <p className="max-w-[16rem] truncate text-sm font-semibold text-indigo-700">{joinUrl}</p>
          <p className="mt-0.5 text-xs text-slate-400">hoặc quét mã QR bên cạnh</p>
        </div>

        <div className="hidden h-14 w-px bg-slate-200 sm:block" />

        <div className="flex flex-col items-center gap-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Mã phòng
          </p>
          <div className="gs-glow-pulse rounded-xl bg-indigo-50 px-6 py-2 text-4xl font-black tracking-[0.2em] text-indigo-900 sm:text-5xl">
            {code}
          </div>
        </div>

        <div className="hidden h-14 w-px bg-slate-200 sm:block" />

        {joinUrl && (
          <div className="flex-none rounded-lg border border-slate-200 p-1.5">
            <QRCode value={joinUrl} size={84} />
          </div>
        )}
      </div>

      {/* "Màn hình" lớp học — hiện học viên vào real-time, giống chiếu lên máy chiếu */}
      <div className="relative overflow-hidden rounded-3xl border-4 border-white/15 bg-gradient-to-br from-brand-800/70 to-pink-900/70 p-6 shadow-2xl sm:p-10">
        <p className="text-center text-sm font-medium text-white/60">
          {participants.length === 0
            ? "Đang chờ học viên tham gia..."
            : "Học viên đã vào phòng — sẵn sàng khi bạn bấm Bắt đầu"}
        </p>

        {teamModeEnabled ? (
          <div className="mt-6 grid min-h-[6rem] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {teamStandings.map((t) => {
              const colors = teamColorClasses(t.colorKey);
              return (
                <div key={t.teamId} className="rounded-xl bg-white/10 p-3">
                  <p
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text}`}
                  >
                    {emojiForColorKey(t.colorKey)} {t.name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {t.members.map((m, i) => (
                      <span
                        key={m.participantId}
                        style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}
                        className="gs-pop-in flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-xs font-medium"
                      >
                        <Avatar avatarKey={m.avatarKey} size="text-sm" />
                        {m.displayName}
                      </span>
                    ))}
                    {t.members.length === 0 && (
                      <span className="text-xs text-white/30">Chưa có ai</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 flex min-h-[6rem] flex-wrap items-center justify-center gap-2">
            {participants.map((p, i) => (
              <span
                key={p.participantId}
                style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}
                className="gs-pop-in flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium"
              >
                <Avatar avatarKey={p.avatarKey} size="text-lg" />
                <span>{p.displayName}</span>
              </span>
            ))}
            {participants.length === 0 && (
              <span className="text-sm text-white/40">Chưa có ai tham gia...</span>
            )}
          </div>
        )}

        <div className="absolute bottom-3 right-4 flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 text-xs font-semibold text-white/80">
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path d="M7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path d="M13.5 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" opacity="0.6" />
            <path d="M2 16c0-2.9 2.46-5 5.5-5s5.5 2.1 5.5 5v.5H2V16Z" />
            <path
              d="M13.5 11.2c2.42.32 4 2.13 4 4.3v.5h-3v-.5c0-1.6-.53-2.98-1.5-4.02.17-.1.34-.19.5-.28Z"
              opacity="0.6"
            />
          </svg>
          {participants.length}
        </div>
      </div>
    </div>
  );
}

function PlayView({
  snap,
  currentQuestion,
  answeredCount,
  participants,
  teamStandings,
  busy,
  onReveal,
  onNext,
}: {
  snap: Snapshot;
  currentQuestion: Question;
  answeredCount: number;
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

  const remainingSec = Math.ceil(remainingMs / 1000);

  return (
    <div className="mt-6 flex flex-col gap-4 lg:flex-row">
      <div className="flex-1 rounded-3xl bg-white/95 p-6 text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
          <span>
            Câu {snap.currentQuestionIndex + 1}/{snap.questions.length}
          </span>
          {snap.status === "running" && (
            <span
              className={`rounded-full px-2.5 py-1 font-mono ${
                remainingSec <= 5 ? "bg-red-100 text-red-700" : "bg-indigo-100 text-indigo-700"
              }`}
            >
              ⏱ {remainingSec}s
            </span>
          )}
          <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-700">
            {answeredCount}/{participants.length} đã trả lời
          </span>
        </div>
        <h2 className="mt-3 text-xl font-bold">{currentQuestion.prompt}</h2>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {currentQuestion.options.map((o, i) => {
            const palette = [
              "from-red-500 to-rose-500",
              "from-blue-500 to-indigo-500",
              "from-amber-400 to-yellow-500",
              "from-emerald-500 to-teal-500",
            ];
            const isCorrect = o.isCorrect;
            return (
              <div
                key={o.id}
                className={`rounded-xl bg-gradient-to-r px-4 py-4 text-sm font-semibold text-white shadow ${
                  palette[i % palette.length]
                } ${isRevealed && !isCorrect ? "opacity-40" : ""} ${
                  isRevealed && isCorrect ? "ring-4 ring-green-400" : ""
                }`}
              >
                {o.label}
                {isRevealed && isCorrect && " ✅"}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          {snap.status === "running" && (
            <button
              onClick={onReveal}
              disabled={busy}
              className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
            >
              Xem đáp án
            </button>
          )}
          {snap.status === "reveal" && (
            <button
              onClick={onNext}
              disabled={busy}
              className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-2.5 text-sm font-bold text-indigo-950 shadow hover:scale-105"
            >
              {snap.currentQuestionIndex + 1 >= snap.questions.length
                ? "Xem kết quả cuối"
                : "Câu tiếp theo →"}
            </button>
          )}
        </div>
      </div>

      <LiveLeaderboard
        participants={participants}
        teamModeEnabled={snap.teamModeEnabled}
        teamStandings={teamStandings}
      />
    </div>
  );
}

function LiveLeaderboard({
  participants,
  teamModeEnabled,
  teamStandings,
}: {
  participants: LiveParticipant[];
  teamModeEnabled: boolean;
  teamStandings: TeamStanding[];
}) {
  return (
    <aside className="w-full flex-none rounded-3xl bg-white/10 p-4 shadow-2xl backdrop-blur-sm lg:w-72">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-white/90">
        🏆 Bảng xếp hạng
      </h3>
      {teamModeEnabled ? (
        <ol className="mt-3 space-y-1.5">
          {teamStandings.map((t, i) => {
            const colors = teamColorClasses(t.colorKey);
            return (
              <li
                key={t.teamId}
                className={`rounded-lg px-3 py-2 text-sm ${colors.bg} ${colors.text}`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex min-w-0 items-center gap-2 font-semibold">
                    <span className="w-4 flex-none text-right text-xs">{i + 1}</span>
                    <span>{emojiForColorKey(t.colorKey)}</span>
                    <span className="truncate">{t.name}</span>
                  </span>
                  <span className="flex-none font-bold">{t.avgScore}</span>
                </div>
              </li>
            );
          })}
          {teamStandings.length === 0 && (
            <li className="text-xs text-white/40">Chưa có dữ liệu</li>
          )}
        </ol>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {participants.slice(0, 8).map((p, i) => (
            <li
              key={p.participantId}
              className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-sm"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-4 flex-none text-right text-xs font-bold text-white/50">
                  {i + 1}
                </span>
                <Avatar avatarKey={p.avatarKey} size="text-base" />
                <span className="truncate">{p.displayName}</span>
                {p.streak >= 2 && <span className="flex-none text-xs">🔥{p.streak}</span>}
              </span>
              <span className="flex-none font-bold text-amber-300">{p.totalScore}</span>
            </li>
          ))}
          {participants.length === 0 && (
            <li className="text-xs text-white/40">Chưa có dữ liệu</li>
          )}
        </ol>
      )}
    </aside>
  );
}

const MEDAL = ["🥇", "🥈", "🥉"];
const PODIUM_HEIGHT = ["h-40 sm:h-56", "h-28 sm:h-40", "h-20 sm:h-28"];
const PODIUM_ORDER = [1, 0, 2]; // hiện #2 - #1 - #3 giống bục thật

function PodiumView({
  participants,
  teamModeEnabled,
  teamStandings,
}: {
  participants: LiveParticipant[];
  teamModeEnabled: boolean;
  teamStandings: TeamStanding[];
}) {
  const top3 = teamModeEnabled ? teamStandings.slice(0, 3) : participants.slice(0, 3);
  const rest = teamModeEnabled ? teamStandings.slice(3) : participants.slice(3);

  const confetti = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i * 0.13) % 2.5}s`,
        duration: `${2 + (i % 5) * 0.3}s`,
        color: ["#facc15", "#f472b6", "#60a5fa", "#4ade80", "#fb923c"][i % 5],
      })),
    [],
  );

  return (
    <div className="mt-6 rounded-3xl bg-white/10 p-6 text-center shadow-2xl backdrop-blur-sm sm:p-10">
      <h2 className="text-2xl font-black sm:text-3xl">🏁 Kết thúc!</h2>

      <div className="relative mt-8 flex items-end justify-center gap-3 overflow-hidden pb-2 sm:gap-6">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="gs-confetti pointer-events-none absolute top-0 h-2.5 w-2.5 rounded-sm"
            style={{
              left: c.left,
              backgroundColor: c.color,
              animationDelay: c.delay,
              animationDuration: c.duration,
            }}
          />
        ))}

        {PODIUM_ORDER.map((rank) => {
          const entry = top3[rank] as LiveParticipant | TeamStanding | undefined;
          if (!entry) return <div key={rank} className="w-24 sm:w-32" />;
          const isTeam = teamModeEnabled;
          const team = isTeam ? (entry as TeamStanding) : null;
          const p = !isTeam ? (entry as LiveParticipant) : null;
          const colors = team ? teamColorClasses(team.colorKey) : null;
          const key = team ? team.teamId : p!.participantId;
          const score = team ? team.avgScore : p!.totalScore;
          return (
            <div
              key={key}
              className="gs-podium-rise flex w-24 flex-col items-center sm:w-32"
              style={{ animationDelay: `${rank * 150}ms` }}
            >
              <div className="gs-float mb-2 flex flex-col items-center">
                <span className="text-3xl sm:text-4xl">{MEDAL[rank]}</span>
                {team ? (
                  <>
                    <span className="text-3xl sm:text-5xl">{emojiForColorKey(team.colorKey)}</span>
                    <span className="mt-1 max-w-[6rem] truncate text-sm font-bold sm:max-w-[8rem]">
                      {team.name}
                    </span>
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                      {team.members.slice(0, 6).map((m) => (
                        <span key={m.participantId} className="text-sm" title={m.displayName}>
                          {AVATARS[m.avatarKey] ?? "🙂"}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-3xl sm:text-5xl">{AVATARS[p!.avatarKey] ?? "🙂"}</span>
                    <span className="mt-1 max-w-[6rem] truncate text-sm font-bold sm:max-w-[8rem]">
                      {p!.displayName}
                    </span>
                  </>
                )}
                <span className="text-xs font-semibold text-amber-300">{score} điểm</span>
              </div>
              <div
                className={`w-full rounded-t-xl ${PODIUM_HEIGHT[rank]} ${
                  colors
                    ? colors.bg
                    : rank === 0
                      ? "bg-gradient-to-b from-amber-300 to-amber-500"
                      : rank === 1
                        ? "bg-gradient-to-b from-slate-200 to-slate-400"
                        : "bg-gradient-to-b from-orange-300 to-orange-500"
                } flex items-start justify-center pt-2 text-2xl font-black text-white/90`}
              >
                {rank + 1}
              </div>
            </div>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ol className="mx-auto mt-8 max-w-md space-y-1.5 text-left">
          {teamModeEnabled
            ? (rest as TeamStanding[]).map((t, i) => (
                <li
                  key={t.teamId}
                  className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-right text-xs font-bold text-white/50">{i + 4}</span>
                    <span>{emojiForColorKey(t.colorKey)}</span>
                    <span>{t.name}</span>
                  </span>
                  <span className="font-bold text-amber-300">{t.avgScore}</span>
                </li>
              ))
            : (rest as LiveParticipant[]).map((p, i) => (
                <li
                  key={p.participantId}
                  className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-5 text-right text-xs font-bold text-white/50">{i + 4}</span>
                    <Avatar avatarKey={p.avatarKey} size="text-base" />
                    <span>{p.displayName}</span>
                  </span>
                  <span className="font-bold text-amber-300">{p.totalScore}</span>
                </li>
              ))}
        </ol>
      )}

      {(teamModeEnabled ? teamStandings.length === 0 : participants.length === 0) && (
        <p className="mt-6 text-sm text-white/50">Không có học viên nào tham gia phiên này.</p>
      )}
    </div>
  );
}
