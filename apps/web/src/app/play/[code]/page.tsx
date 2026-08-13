"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import { AVATARS, AVATAR_KEYS, randomAvatarKey } from "@/lib/gameshow/avatars";

type RoomInfo = {
  id: string;
  status: string;
  quizTitle: string;
  questionCount: number;
  participantCount: number;
};
type Identity = {
  sessionId: string;
  participantId: string;
  participantToken: string;
  avatarKey: string;
  displayName: string;
};
type QuestionOption = { id: string; label: string };
type LiveParticipant = {
  participantId: string;
  displayName: string;
  avatarKey: string;
  totalScore: number;
  streak: number;
};
type AnswerResult = { isCorrect: boolean; pointsAwarded: number; totalScore: number };

type Phase = "loading" | "invalid" | "name" | "waiting" | "question" | "answered" | "reveal" | "ended";

function storageKey(code: string) {
  return `fbm-gameshow-${code}`;
}

export default function PlayGameshowPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code || "").toUpperCase();

  const [phase, setPhase] = useState<Phase>("loading");
  const [invalidReason, setInvalidReason] = useState("Link không hợp lệ.");
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [avatarKey, setAvatarKey] = useState(randomAvatarKey());
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [question, setQuestion] = useState<{
    prompt: string;
    options: QuestionOption[];
  } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [timeLimitMs, setTimeLimitMs] = useState(20_000);
  const [remainingMs, setRemainingMs] = useState(0);
  const [pendingPowerUp, setPendingPowerUp] = useState<"double_points" | "immunity" | null>(null);
  const [usedPowerUps, setUsedPowerUps] = useState<Set<string>>(new Set());
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
  const [chosenOptionId, setChosenOptionId] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  // 1) Room lookup + reconnect từ sessionStorage
  useEffect(() => {
    if (!code) return;
    (async () => {
      const r = await fetch(apiUrl(`/api/gameshow/sessions/by-code/${code}`));
      if (!r.ok) {
        setInvalidReason("Không tìm thấy phòng với mã này.");
        setPhase("invalid");
        return;
      }
      const j = (await r.json()) as RoomInfo;
      setRoom(j);
      setQuestionCount(j.questionCount);

      const saved = sessionStorage.getItem(storageKey(code));
      if (saved) {
        try {
          const id = JSON.parse(saved) as Identity;
          if (id.sessionId === j.id) {
            setIdentity(id);
            await rehydrate(id);
            return;
          }
        } catch {
          // ignore corrupt storage
        }
      }

      if (j.status !== "lobby") {
        setInvalidReason("Phòng đã bắt đầu — không thể tham gia nữa.");
        setPhase("invalid");
        return;
      }
      setPhase("name");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function rehydrate(id: Identity) {
    const r = await fetch(
      apiUrl(`/api/gameshow/sessions/${id.sessionId}/state?participantId=${id.participantId}`),
    );
    if (!r.ok) {
      setPhase("name");
      return;
    }
    const s = await r.json();
    setParticipants(s.participants);
    setQuestionCount(s.questionCount);
    setQuestionIndex(s.currentQuestionIndex);
    setTimeLimitMs(s.timeLimitMs);
    if (s.status === "lobby") setPhase("waiting");
    else if (s.status === "ended") setPhase("ended");
    else {
      setQuestion(s.currentQuestion);
      setStartedAt(s.currentQuestionStartedAt);
      if (s.status === "reveal") {
        setCorrectOptionId(s.correctOptionId);
        setPhase("reveal");
      } else {
        setPhase(s.alreadyAnswered ? "answered" : "question");
      }
    }
  }

  // 1b) Resync khi tab quay lại foreground — điện thoại học viên khoá màn
  // hình / chuyển app rất phổ biến trong lớp học. EventSource có thể bị
  // trình duyệt tạm dừng xử lý lúc backgrounded và bỏ lỡ event (SSE không
  // replay event đã publish trước khi reconnect); fetch lại /state để tự
  // sửa nếu state cục bộ bị lệch so với server.
  useEffect(() => {
    if (!identity) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") rehydrate(identity);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);

  // 2) SSE — chỉ mở sau khi có identity
  useEffect(() => {
    if (!identity) return;
    const es = new EventSource(apiUrl(`/api/gameshow/sessions/${identity.sessionId}/stream`));
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
      } else if (type === "question.started") {
        setQuestionIndex(data.questionIndex as number);
        setQuestion({
          prompt: data.prompt as string,
          options: data.options as QuestionOption[],
        });
        setStartedAt(data.startedAt as number);
        setTimeLimitMs(data.timeLimitMs as number);
        setPendingPowerUp(null);
        setChosenOptionId(null);
        setAnswerResult(null);
        setAnswerError(null);
        setCorrectOptionId(null);
        setPhase("question");
      } else if (type === "question.ended") {
        setCorrectOptionId(data.correctOptionId as string | null);
        setParticipants(data.leaderboard as LiveParticipant[]);
        setPhase("reveal");
      } else if (type === "leaderboard.updated") {
        setParticipants(data.leaderboard as LiveParticipant[]);
      } else if (type === "game.ended") {
        setParticipants(data.leaderboard as LiveParticipant[]);
        setPhase("ended");
      }
    };
    return () => es.close();
  }, [identity]);

  // 3) Countdown timer
  useEffect(() => {
    if (phase !== "question" || startedAt === null) return;
    const tick = () => {
      const left = Math.max(0, timeLimitMs - (Date.now() - startedAt));
      setRemainingMs(left);
    };
    tick();
    const t = setInterval(tick, 200);
    return () => clearInterval(t);
  }, [phase, startedAt, timeLimitMs]);

  const onJoin = async () => {
    if (!room || !displayName.trim()) return;
    setJoining(true);
    setJoinErr(null);
    try {
      const r = await fetch(apiUrl(`/api/gameshow/sessions/by-code/${code}/join`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), avatarKey }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setJoinErr(
          j?.error === "name_taken"
            ? "Tên này đã có người dùng trong phòng — chọn tên khác."
            : (j?.error ?? `HTTP ${r.status}`),
        );
        return;
      }
      const j = await r.json();
      const id: Identity = {
        sessionId: j.sessionId,
        participantId: j.participantId,
        participantToken: j.participantToken,
        avatarKey: j.avatarKey,
        displayName: displayName.trim(),
      };
      sessionStorage.setItem(storageKey(code), JSON.stringify(id));
      // Seed chính mình vào roster ngay — SSE của tab này mở SAU khi event
      // "participant.joined" của chính mình đã publish xong nên sẽ không
      // bao giờ nhận lại được nó (cursor "$" chỉ lấy event mới).
      setParticipants((prev) =>
        prev.some((p) => p.participantId === id.participantId)
          ? prev
          : [...prev, { participantId: id.participantId, displayName: id.displayName, avatarKey: id.avatarKey, totalScore: 0, streak: 0 }],
      );
      setIdentity(id);
      setPhase("waiting");
    } finally {
      setJoining(false);
    }
  };

  const onChangeAvatarInLobby = async (key: string) => {
    setAvatarKey(key);
    if (!identity) return;
    setIdentity({ ...identity, avatarKey: key });
    await fetch(apiUrl(`/api/gameshow/sessions/${identity.sessionId}/avatar`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        participantId: identity.participantId,
        participantToken: identity.participantToken,
        avatarKey: key,
      }),
    });
  };

  const onAnswer = async (optionId: string) => {
    if (!identity || phase !== "question") return;
    setChosenOptionId(optionId);
    setAnswerError(null);
    setPhase("answered");
    const r = await fetch(apiUrl(`/api/gameshow/sessions/${identity.sessionId}/answer`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        participantId: identity.participantId,
        participantToken: identity.participantToken,
        questionIndex,
        optionId,
        powerUp: pendingPowerUp ?? undefined,
      }),
    });
    if (r.ok) {
      const j = (await r.json()) as AnswerResult;
      setAnswerResult(j);
      if (pendingPowerUp) setUsedPowerUps((prev) => new Set(prev).add(pendingPowerUp));
      return;
    }
    // Gửi trễ (câu đã đóng đúng lúc bấm) hoặc lỗi khác — vẫn phải cho biết,
    // không được im lặng để người chơi đứng hình chờ "chờ kết quả..." mãi.
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    setAnswerError(
      j?.error === "stale_question" || j?.error === "invalid_status"
        ? "⏱️ Hết giờ ngay lúc bạn gửi — câu này không tính điểm."
        : j?.error === "already_answered"
          ? "Bạn đã trả lời câu này rồi."
          : "Gửi câu trả lời thất bại. Kết quả câu này sẽ không được tính.",
    );
  };

  if (phase === "loading") {
    return <main className="mx-auto max-w-md px-4 py-16 text-center text-sm text-faint">Đang tải...</main>;
  }

  if (phase === "invalid") {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-xl font-bold">😕 {invalidReason}</h1>
      </main>
    );
  }

  if (phase === "name") {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <h1 className="text-center text-xl font-bold">🎮 {room?.quizTitle}</h1>
        <p className="mt-1 text-center text-sm text-faint">Nhập tên để tham gia</p>

        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={30}
          placeholder="Tên của bạn"
          className="mt-6 w-full rounded-lg border border-default px-4 py-3 text-center text-lg"
        />

        <p className="mt-4 text-center text-sm text-faint">Chọn avatar</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {AVATAR_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setAvatarKey(key)}
              className={`rounded-lg border p-3 text-3xl ${
                avatarKey === key ? "border-blue-500 bg-blue-50" : "border-default bg-white"
              }`}
            >
              {AVATARS[key]}
            </button>
          ))}
        </div>

        {joinErr && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            ⚠ {joinErr}
          </div>
        )}

        <button
          onClick={onJoin}
          disabled={joining || !displayName.trim()}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {joining ? "Đang vào..." : "Tham gia →"}
        </button>
      </main>
    );
  }

  if (phase === "waiting") {
    return (
      <main className="mx-auto max-w-md px-4 py-10 text-center">
        <h1 className="text-xl font-bold">✅ Đã vào phòng!</h1>
        <p className="mt-1 text-sm text-faint">Đang chờ giảng viên bắt đầu...</p>

        <p className="mt-6 text-sm text-faint">Đổi avatar</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {AVATAR_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => onChangeAvatarInLobby(key)}
              className={`rounded-lg border p-3 text-3xl ${
                identity?.avatarKey === key ? "border-blue-500 bg-blue-50" : "border-default bg-white"
              }`}
            >
              {AVATARS[key]}
            </button>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {participants.map((p) => (
            <span
              key={p.participantId}
              className="flex items-center gap-1 rounded-full bg-[rgb(var(--surface-muted))] px-3 py-1 text-sm"
            >
              <span>{AVATARS[p.avatarKey] ?? "🙂"}</span>
              <span>{p.displayName}</span>
            </span>
          ))}
        </div>
      </main>
    );
  }

  if (phase === "question" || phase === "answered") {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="flex items-center justify-between text-xs text-faint">
          <span>
            Câu {questionIndex + 1}/{questionCount}
          </span>
          {phase === "question" && (
            <span className="font-mono font-semibold">{Math.ceil(remainingMs / 1000)}s</span>
          )}
        </div>
        <h2 className="mt-2 text-lg font-semibold">{question?.prompt}</h2>

        {phase === "question" && (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() =>
                setPendingPowerUp((p) => (p === "double_points" ? null : "double_points"))
              }
              disabled={usedPowerUps.has("double_points")}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium disabled:opacity-40 ${
                pendingPowerUp === "double_points"
                  ? "border-amber-500 bg-amber-50"
                  : "border-default bg-white"
              }`}
            >
              ⚡ x2 điểm
            </button>
            <button
              onClick={() => setPendingPowerUp((p) => (p === "immunity" ? null : "immunity"))}
              disabled={usedPowerUps.has("immunity")}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium disabled:opacity-40 ${
                pendingPowerUp === "immunity" ? "border-amber-500 bg-amber-50" : "border-default bg-white"
              }`}
            >
              🛡️ Miễn nhiễm
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3">
          {question?.options.map((o) => (
            <button
              key={o.id}
              onClick={() => onAnswer(o.id)}
              disabled={phase === "answered"}
              className={`rounded-lg border px-4 py-4 text-left text-base ${
                chosenOptionId === o.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-default bg-white hover:bg-slate-50"
              } disabled:opacity-60`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {phase === "answered" && (
          <p
            className={`mt-4 text-center text-sm ${answerError ? "font-medium text-amber-600" : "text-faint"}`}
          >
            {answerError
              ? answerError
              : answerResult
                ? answerResult.isCorrect
                  ? `✅ Đúng! +${answerResult.pointsAwarded} điểm`
                  : answerResult.pointsAwarded > 0
                    ? `🛡️ Sai, nhưng Miễn nhiễm cứu bạn! +${answerResult.pointsAwarded} điểm`
                    : "❌ Sai rồi"
                : "Đã gửi — chờ kết quả..."}
          </p>
        )}
      </main>
    );
  }

  if (phase === "reveal" || phase === "ended") {
    const sorted = [...participants].sort((a, b) => b.totalScore - a.totalScore);
    const myRank = identity ? sorted.findIndex((p) => p.participantId === identity.participantId) + 1 : 0;
    return (
      <main className="mx-auto max-w-md px-4 py-8">
        {phase === "reveal" && question && (
          <>
            <h2 className="text-lg font-semibold">{question.prompt}</h2>
            <div className="mt-3 space-y-2">
              {question.options.map((o) => (
                <div
                  key={o.id}
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    o.id === correctOptionId
                      ? "border-green-400 bg-green-50 font-semibold text-green-800"
                      : "border-default bg-white"
                  }`}
                >
                  {o.label} {o.id === correctOptionId && "✅"}
                </div>
              ))}
            </div>
            {answerResult ? (
              <p className="mt-3 text-center text-sm">
                {answerResult.pointsAwarded > 0
                  ? `+${answerResult.pointsAwarded} điểm`
                  : "Không có điểm câu này"}
              </p>
            ) : (
              answerError &&
              chosenOptionId && (
                <p className="mt-3 text-center text-sm font-medium text-amber-600">
                  {answerError}
                </p>
              )
            )}
          </>
        )}

        {phase === "ended" && <h1 className="text-center text-2xl font-bold">🏁 Kết thúc!</h1>}

        {identity && myRank > 0 && (
          <p className="mt-4 text-center text-sm font-semibold">
            Hạng của bạn: #{myRank} · {sorted[myRank - 1]?.totalScore ?? 0} điểm
          </p>
        )}

        <ol className="mt-4 space-y-1">
          {sorted.slice(0, 10).map((p, i) => (
            <li
              key={p.participantId}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                identity?.participantId === p.participantId
                  ? "bg-blue-50"
                  : "bg-[rgb(var(--surface-muted))]"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="w-5 text-right font-bold text-faint">{i + 1}</span>
                <span>{AVATARS[p.avatarKey] ?? "🙂"}</span>
                <span>{p.displayName}</span>
              </span>
              <span className="font-semibold">{p.totalScore}</span>
            </li>
          ))}
        </ol>
      </main>
    );
  }

  return null;
}
