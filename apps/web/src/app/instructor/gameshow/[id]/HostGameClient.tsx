"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { AVATARS } from "@/lib/gameshow/avatars";

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
  totalScore: number;
  streak: number;
};

type Snapshot = {
  id: string;
  code: string;
  status: Status;
  quizTitle: string;
  currentQuestionIndex: number;
  timeLimitMs: number;
  answeredCount: number;
  questions: Question[];
  participants: LiveParticipant[];
};

export default function HostGameClient({ sessionId }: { sessionId: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
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

  const call = async (action: string) => {
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
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      // Optimistic local update cho hành động của chính host — không đợi SSE
      // round-trip. Phải khớp CHÍNH XÁC những gì server trả về (đặc biệt
      // "ended"), nếu không sẽ đua với event "game.ended" từ SSE và ghi đè
      // ngược "ended" -> "running" với currentQuestionIndex vượt quá mảng câu hỏi.
      if (action === "start") {
        setAnsweredCount(0);
        setSnap((s) =>
          s ? { ...s, status: "running", currentQuestionIndex: j?.questionIndex ?? 0 } : s,
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
                }
              : s,
          );
        }
      }
    } finally {
      setBusy(false);
    }
  };

  if (!snap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-900 to-fuchsia-900 text-sm text-white/70">
        Đang tải...
      </div>
    );
  }

  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/play/${snap.code}` : "";
  const currentQuestion = snap.questions[snap.currentQuestionIndex];
  const sorted = [...participants].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-fuchsia-900 px-4 py-6 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-lg font-bold sm:text-xl">
            🎮 <span className="truncate">{snap.quizTitle}</span>
          </h1>
          {snap.status !== "ended" && (
            <button
              onClick={() => {
                if (window.confirm("Kết thúc phiên gameshow?")) call("end");
              }}
              disabled={busy}
              className="flex-none rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/20"
            >
              Kết thúc sớm
            </button>
          )}
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
            busy={busy}
            onStart={() => call("start")}
          />
        )}

        {(snap.status === "running" || snap.status === "reveal") && currentQuestion && (
          <PlayView
            snap={snap}
            currentQuestion={currentQuestion}
            answeredCount={answeredCount}
            participants={sorted}
            busy={busy}
            onReveal={() => call("reveal")}
            onNext={() => call("next")}
          />
        )}

        {snap.status === "ended" && <PodiumView participants={sorted} />}
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
  busy,
  onStart,
}: {
  code: string;
  joinUrl: string;
  participants: LiveParticipant[];
  busy: boolean;
  onStart: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center gap-6 rounded-3xl bg-white/10 p-6 text-center shadow-2xl backdrop-blur-sm sm:p-10">
      <p className="text-sm font-medium text-white/70">Học viên vào bằng mã hoặc quét QR</p>

      <div className="gs-glow-pulse rounded-2xl bg-white px-8 py-4 text-5xl font-black tracking-[0.2em] text-indigo-900 sm:text-6xl">
        {code}
      </div>

      {joinUrl && (
        <div className="rounded-xl bg-white p-3">
          <QRCode value={joinUrl} size={160} />
        </div>
      )}
      <p className="text-xs text-white/50">{joinUrl}</p>

      <div className="w-full">
        <p className="text-sm font-semibold text-white/80">
          {participants.length} học viên đã vào phòng
        </p>
        <div className="mt-3 flex min-h-[3rem] flex-wrap justify-center gap-2">
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
      </div>

      <button
        onClick={onStart}
        disabled={busy}
        className="mt-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-8 py-3 text-base font-bold text-indigo-950 shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
      >
        ▶ Bắt đầu ({participants.length} học viên)
      </button>
    </div>
  );
}

function PlayView({
  snap,
  currentQuestion,
  answeredCount,
  participants,
  busy,
  onReveal,
  onNext,
}: {
  snap: Snapshot;
  currentQuestion: Question;
  answeredCount: number;
  participants: LiveParticipant[];
  busy: boolean;
  onReveal: () => void;
  onNext: () => void;
}) {
  const isRevealed = snap.status === "reveal";

  return (
    <div className="mt-6 flex flex-col gap-4 lg:flex-row">
      <div className="flex-1 rounded-3xl bg-white/95 p-6 text-slate-900 shadow-2xl">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
          <span>
            Câu {snap.currentQuestionIndex + 1}/{snap.questions.length}
          </span>
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

      <LiveLeaderboard participants={participants} />
    </div>
  );
}

function LiveLeaderboard({ participants }: { participants: LiveParticipant[] }) {
  return (
    <aside className="w-full flex-none rounded-3xl bg-white/10 p-4 shadow-2xl backdrop-blur-sm lg:w-72">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-white/90">
        🏆 Bảng xếp hạng
      </h3>
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
    </aside>
  );
}

const MEDAL = ["🥇", "🥈", "🥉"];
const PODIUM_HEIGHT = ["h-40 sm:h-56", "h-28 sm:h-40", "h-20 sm:h-28"];
const PODIUM_ORDER = [1, 0, 2]; // hiện #2 - #1 - #3 giống bục thật

function PodiumView({ participants }: { participants: LiveParticipant[] }) {
  const top3 = participants.slice(0, 3);
  const rest = participants.slice(3);

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
          const p = top3[rank];
          if (!p) return <div key={rank} className="w-24 sm:w-32" />;
          return (
            <div
              key={p.participantId}
              className="gs-podium-rise flex w-24 flex-col items-center sm:w-32"
              style={{ animationDelay: `${rank * 150}ms` }}
            >
              <div className="gs-float mb-2 flex flex-col items-center">
                <span className="text-3xl sm:text-4xl">{MEDAL[rank]}</span>
                <span className="text-3xl sm:text-5xl">{AVATARS[p.avatarKey] ?? "🙂"}</span>
                <span className="mt-1 max-w-[6rem] truncate text-sm font-bold sm:max-w-[8rem]">
                  {p.displayName}
                </span>
                <span className="text-xs font-semibold text-amber-300">{p.totalScore} điểm</span>
              </div>
              <div
                className={`w-full rounded-t-xl ${PODIUM_HEIGHT[rank]} ${
                  rank === 0
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
          {rest.map((p, i) => (
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

      {participants.length === 0 && (
        <p className="mt-6 text-sm text-white/50">Không có học viên nào tham gia phiên này.</p>
      )}
    </div>
  );
}
