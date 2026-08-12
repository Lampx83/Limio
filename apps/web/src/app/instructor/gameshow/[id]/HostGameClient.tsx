"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";
import { AVATARS } from "@/lib/gameshow/avatars";

const QRCode = dynamic(() => import("qrcode.react").then((mod) => mod.QRCodeSVG), {
  ssr: false,
  loading: () => (
    <div
      className="rounded-lg border border-token bg-white p-3"
      style={{ width: 180, height: 180 }}
    />
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
  questions: Question[];
  participants: LiveParticipant[];
};

export default function HostGameClient({ sessionId }: { sessionId: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const load = async () => {
    const r = await fetch(apiUrl(`/api/gameshow/sessions/${sessionId}`));
    if (!r.ok) {
      setErr(`HTTP ${r.status}`);
      return;
    }
    const j = (await r.json()) as Snapshot;
    setSnap(j);
    setParticipants(j.participants);
    setAnsweredCount(0);
    setCorrectOptionId(null);
  };

  useEffect(() => {
    load();
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
        setCorrectOptionId(data.correctOptionId as string | null);
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
        setCorrectOptionId(null);
        setSnap((s) =>
          s ? { ...s, status: "running", currentQuestionIndex: j?.questionIndex ?? 0 } : s,
        );
      } else if (action === "next") {
        setAnsweredCount(0);
        setCorrectOptionId(null);
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
    return <main className="mx-auto max-w-3xl px-4 py-8 text-sm text-faint">Đang tải...</main>;
  }

  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/play/${snap.code}` : "";
  const currentQuestion = snap.questions[snap.currentQuestionIndex];
  const sorted = [...participants].sort((a, b) => b.totalScore - a.totalScore);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">🎮 {snap.quizTitle}</h1>
        {snap.status !== "ended" && (
          <button
            onClick={() => {
              if (window.confirm("Kết thúc phiên gameshow?")) call("end");
            }}
            disabled={busy}
            className="rounded border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-800 hover:bg-red-100"
          >
            Kết thúc sớm
          </button>
        )}
      </div>

      {err && (
        <div className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          ⚠ {err}
        </div>
      )}

      {snap.status === "lobby" && (
        <div className="mt-6 flex flex-col items-center gap-4 rounded-2xl border border-token bg-[rgb(var(--surface))] p-8 text-center">
          <p className="text-sm text-faint">Học viên vào bằng mã hoặc quét QR</p>
          <div className="text-4xl font-black tracking-widest">{snap.code}</div>
          {joinUrl && <QRCode value={joinUrl} size={180} />}
          <p className="text-xs text-faint">{joinUrl}</p>

          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {sorted.map((p) => (
              <span
                key={p.participantId}
                className="flex items-center gap-1 rounded-full bg-[rgb(var(--surface-muted))] px-3 py-1 text-sm"
              >
                <span>{AVATARS[p.avatarKey] ?? "🙂"}</span>
                <span>{p.displayName}</span>
              </span>
            ))}
            {sorted.length === 0 && (
              <span className="text-xs text-faint">Chưa có ai tham gia...</span>
            )}
          </div>

          <button
            onClick={() => call("start")}
            disabled={busy}
            className="mt-2 rounded bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            ▶ Bắt đầu ({sorted.length} học viên)
          </button>
        </div>
      )}

      {(snap.status === "running" || snap.status === "reveal") && currentQuestion && (
        <div className="mt-6 rounded-2xl border border-token bg-[rgb(var(--surface))] p-6">
          <div className="flex items-center justify-between text-xs text-faint">
            <span>
              Câu {snap.currentQuestionIndex + 1}/{snap.questions.length}
            </span>
            <span>{answeredCount}/{sorted.length} đã trả lời</span>
          </div>
          <h2 className="mt-2 text-lg font-semibold">{currentQuestion.prompt}</h2>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {currentQuestion.options.map((o) => {
              const isRevealed = snap.status === "reveal";
              const isCorrect = o.isCorrect;
              return (
                <div
                  key={o.id}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    isRevealed && isCorrect
                      ? "border-green-400 bg-green-50 font-semibold text-green-800"
                      : "border-default bg-white"
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
                onClick={() => call("reveal")}
                disabled={busy}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Xem đáp án
              </button>
            )}
            {snap.status === "reveal" && (
              <button
                onClick={() => call("next")}
                disabled={busy}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {snap.currentQuestionIndex + 1 >= snap.questions.length
                  ? "Xem kết quả cuối"
                  : "Câu tiếp theo →"}
              </button>
            )}
          </div>

          {snap.status === "reveal" && (
            <Leaderboard participants={sorted} title="Bảng xếp hạng" />
          )}
        </div>
      )}

      {snap.status === "ended" && (
        <div className="mt-6 rounded-2xl border border-token bg-[rgb(var(--surface))] p-6">
          <h2 className="text-lg font-semibold">🏁 Kết thúc!</h2>
          <Leaderboard participants={sorted} title="Bảng xếp hạng cuối cùng" />
        </div>
      )}
    </main>
  );
}

function Leaderboard({
  participants,
  title,
}: {
  participants: LiveParticipant[];
  title: string;
}) {
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-faint">{title}</h3>
      <ol className="mt-2 space-y-1">
        {participants.map((p, i) => (
          <li
            key={p.participantId}
            className="flex items-center justify-between rounded-lg bg-[rgb(var(--surface-muted))] px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2">
              <span className="w-5 text-right font-bold text-faint">{i + 1}</span>
              <span>{AVATARS[p.avatarKey] ?? "🙂"}</span>
              <span>{p.displayName}</span>
              {p.streak >= 2 && <span className="text-xs text-orange-600">🔥{p.streak}</span>}
            </span>
            <span className="font-semibold">{p.totalScore}</span>
          </li>
        ))}
        {participants.length === 0 && (
          <li className="text-xs text-faint">Chưa có dữ liệu</li>
        )}
      </ol>
    </div>
  );
}
