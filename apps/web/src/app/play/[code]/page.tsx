"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Trophy } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { MAX_PARTICIPANTS_PER_SESSION } from "@/lib/gameshow/constants";
import { AVATARS, AVATAR_KEYS, randomAvatarKey } from "@/lib/gameshow/avatars";
import { emojiForColorKey, teamColorClasses } from "@/lib/gameshow/teams";
import { useRankDeltas } from "@/lib/gameshow/useRankDeltas";
import { useCountUp } from "@/lib/gameshow/useCountUp";
import { Podium } from "@/components/gameshow/Podium";
import { OptionCard, OPTION_LETTERS } from "@/components/gameshow/OptionCard";
import type { OptionState } from "@/components/gameshow/OptionCard";
import type { LiveParticipant, TeamStanding } from "@/lib/gameshow/types";

type TeamOption = { id: string; name: string; colorKey: string; memberCount: number };
type RoomInfo = {
  id: string;
  status: string;
  quizTitle: string;
  questionCount: number;
  participantCount: number;
  teamModeEnabled: boolean;
  teams: TeamOption[];
};
type Identity = {
  sessionId: string;
  participantId: string;
  participantToken: string;
  avatarKey: string;
  displayName: string;
  teamId: string | null;
};
type QuestionOption = { id: string; label: string };
type AnswerResult = { isCorrect: boolean; pointsAwarded: number; totalScore: number };
type HistoryEntry = {
  questionIndex: number;
  prompt: string;
  options: QuestionOption[];
  correctOptionId: string | null;
  chosenOptionId: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number;
};

type Phase =
  | "loading"
  | "invalid"
  | "name"
  | "team"
  | "waiting"
  | "question"
  | "answered"
  | "reveal"
  | "ended";

function storageKey(code: string) {
  return `fbm-gameshow-${code}`;
}

// Nền tối xanh chanh -> hồng — dùng cho các phase "ngoài giờ chơi" (tên/đội/
// chờ/bảng điểm giữa câu/kết thúc) để giữ cảm giác gameshow. Riêng màn hình
// TRẢ LỜI CÂU HỎI (question/answered) cố tình tách khỏi theme này — đổi
// sang nền sáng tối giản kiểu Duolingo/Brilliant theo yêu cầu thiết kế
// riêng, không còn palette 4 màu + icon hình khối kiểu Kahoot (xem
// OptionCard). Khác host ở chỗ không ẩn header chung, xem ghi chú ở
// HostGameClient.
const SHELL = "min-h-screen bg-gradient-to-br from-brand-900 via-gray-950 to-pink-900 text-white";
const QUESTION_SPLASH_MS = 650;

// Thanh tiến trình ngang — thay vòng tròn đếm ngược kiểu Kahoot. Rút cạn từ
// 100% -> 0%, đổi màu Xanh brand -> Hổ phách -> Đỏ theo % thời gian còn lại.
function LinearTimer({ remainingMs, totalMs }: { remainingMs: number; totalMs: number }) {
  const fraction = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const urgent = fraction <= 0.25;
  const warn = fraction <= 0.5 && !urgent;
  const color = urgent ? "bg-red-500" : warn ? "bg-amber-400" : "bg-brand-500";
  return (
    <div className="h-1.5 w-full flex-none bg-slate-200">
      <div
        className={`h-full ${color} ${urgent ? "gs-timer-urgent" : ""}`}
        style={{
          width: `${fraction * 100}%`,
          transition: "width 0.2s linear, background-color 0.3s ease",
        }}
      />
    </div>
  );
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
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [teamStandings, setTeamStandings] = useState<TeamStanding[]>([]);
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
  const [localStreak, setLocalStreak] = useState(0);
  const [showSplash, setShowSplash] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showReview, setShowReview] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const splashForIndex = useRef<number | null>(null);

  // Ref "theo sau" state mới nhất — SSE handler đăng ký 1 lần (dep [identity])
  // nên closure của nó bị đóng băng tại thời điểm effect chạy; cần ref để
  // đọc được giá trị MỚI NHẤT của question/chosenOptionId/answerResult lúc
  // "question.ended" tới (dùng để dựng "Xem lại câu hỏi").
  const questionRef = useRef(question);
  useEffect(() => {
    questionRef.current = question;
  }, [question]);
  const questionIndexRef = useRef(questionIndex);
  useEffect(() => {
    questionIndexRef.current = questionIndex;
  }, [questionIndex]);
  const chosenOptionIdRef = useRef(chosenOptionId);
  useEffect(() => {
    chosenOptionIdRef.current = chosenOptionId;
  }, [chosenOptionId]);
  const answerResultRef = useRef(answerResult);
  useEffect(() => {
    answerResultRef.current = answerResult;
  }, [answerResult]);

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
      if (j.participantCount >= MAX_PARTICIPANTS_PER_SESSION) {
        setInvalidReason(
          `Phòng đã đầy (tối đa ${MAX_PARTICIPANTS_PER_SESSION} người) — không thể tham gia thêm.`,
        );
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
    setTeamStandings(s.teamStandings ?? []);
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
      } else if (type === "participant.kicked") {
        setParticipants((prev) => prev.filter((p) => p.participantId !== data.participantId));
        if (data.participantId === identity.participantId) {
          sessionStorage.removeItem(storageKey(code));
          setIdentity(null);
          setInvalidReason("Giảng viên đã đưa bạn ra khỏi phòng.");
          setPhase("invalid");
        }
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
        if (splashForIndex.current !== data.questionIndex) {
          splashForIndex.current = data.questionIndex as number;
          setShowSplash(true);
          setTimeout(() => setShowSplash(false), QUESTION_SPLASH_MS);
        }
      } else if (type === "question.ended") {
        const q = questionRef.current;
        if (q) {
          setHistory((prev) => [
            ...prev,
            {
              questionIndex: questionIndexRef.current,
              prompt: q.prompt,
              options: q.options,
              correctOptionId: (data.correctOptionId as string | null) ?? null,
              chosenOptionId: chosenOptionIdRef.current,
              isCorrect: answerResultRef.current?.isCorrect ?? null,
              pointsAwarded: answerResultRef.current?.pointsAwarded ?? 0,
            },
          ]);
        }
        setCorrectOptionId(data.correctOptionId as string | null);
        setParticipants(data.leaderboard as LiveParticipant[]);
        if (data.teamStandings) setTeamStandings(data.teamStandings as TeamStanding[]);
        setPhase("reveal");
      } else if (type === "leaderboard.updated") {
        setParticipants(data.leaderboard as LiveParticipant[]);
        if (data.teamStandings) setTeamStandings(data.teamStandings as TeamStanding[]);
      } else if (type === "game.ended") {
        setParticipants(data.leaderboard as LiveParticipant[]);
        if (data.teamStandings) setTeamStandings(data.teamStandings as TeamStanding[]);
        setPhase("ended");
      }
    };
    return () => es.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onProceedFromName = () => {
    if (!displayName.trim()) return;
    if (room?.teamModeEnabled) {
      setPhase("team");
      return;
    }
    onJoin();
  };

  const onJoin = async () => {
    if (!room || !displayName.trim()) return;
    if (room.teamModeEnabled && !selectedTeamId) return;
    setJoining(true);
    setJoinErr(null);
    try {
      const r = await fetch(apiUrl(`/api/gameshow/sessions/by-code/${code}/join`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          avatarKey,
          ...(room.teamModeEnabled ? { teamId: selectedTeamId } : {}),
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setJoinErr(
          j?.error === "name_taken"
            ? "Tên này đã có người dùng trong phòng — chọn tên khác."
            : j?.error === "room_full"
              ? `Phòng đã đầy (tối đa ${MAX_PARTICIPANTS_PER_SESSION} người) — không thể tham gia thêm.`
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
        teamId: j.teamId ?? null,
      };
      sessionStorage.setItem(storageKey(code), JSON.stringify(id));
      // Seed chính mình vào roster ngay — SSE của tab này mở SAU khi event
      // "participant.joined" của chính mình đã publish xong nên sẽ không
      // bao giờ nhận lại được nó (cursor "$" chỉ lấy event mới).
      setParticipants((prev) =>
        prev.some((p) => p.participantId === id.participantId)
          ? prev
          : [
              ...prev,
              {
                participantId: id.participantId,
                displayName: id.displayName,
                avatarKey: id.avatarKey,
                teamId: id.teamId,
                totalScore: 0,
                streak: 0,
              },
            ],
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
      setLocalStreak((s) => (j.isCorrect ? s + 1 : 0));
      if (pendingPowerUp) setUsedPowerUps((prev) => new Set(prev).add(pendingPowerUp));
      return;
    }
    // Gửi trễ (câu đã đóng đúng lúc bấm) hoặc lỗi khác — vẫn phải cho biết,
    // không được im lặng để người chơi đứng hình chờ "chờ kết quả..." mãi.
    const j = (await r.json().catch(() => null)) as { error?: string } | null;
    setLocalStreak(0);
    setAnswerError(
      j?.error === "stale_question" || j?.error === "invalid_status"
        ? "⏱️ Hết giờ ngay lúc bạn gửi — câu này không tính điểm."
        : j?.error === "already_answered"
          ? "Bạn đã trả lời câu này rồi."
          : "Gửi câu trả lời thất bại. Kết quả câu này sẽ không được tính.",
    );
  };

  if (phase === "loading") {
    return (
      <div className={`${SHELL} flex items-center justify-center`}>
        <p className="gs-float text-sm text-white/60">Đang tải...</p>
      </div>
    );
  }

  if (phase === "invalid") {
    return (
      <div className={`${SHELL} flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center`}>
        <span className="text-5xl">😕</span>
        <h1 className="text-xl font-bold">{invalidReason}</h1>
      </div>
    );
  }

  if (phase === "name") {
    return (
      <div className={SHELL}>
        <main className="mx-auto max-w-md px-4 py-10">
          <h1 className="text-center text-2xl font-black">🎮 {room?.quizTitle}</h1>
          <p className="mt-1 text-center text-sm text-white/60">Nhập tên để tham gia</p>

          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={30}
            placeholder="Tên của bạn"
            className="mt-6 w-full rounded-2xl border-0 bg-white px-4 py-4 text-center text-xl font-bold text-indigo-950 shadow-xl placeholder:text-slate-400 placeholder:font-normal"
          />

          <p className="mt-5 text-center text-sm font-semibold text-white/70">Chọn avatar</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {AVATAR_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => setAvatarKey(key)}
                className={`rounded-2xl border-2 p-3 text-3xl transition-transform active:scale-90 ${
                  avatarKey === key
                    ? "border-amber-400 bg-white/20 scale-110"
                    : "border-transparent bg-white/10 hover:bg-white/15"
                }`}
              >
                {AVATARS[key]}
              </button>
            ))}
          </div>

          {joinErr && (
            <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/20 px-3 py-2 text-sm text-red-100">
              ⚠ {joinErr}
            </div>
          )}

          <button
            onClick={onProceedFromName}
            disabled={joining || !displayName.trim()}
            style={{ ["--gs-btn-shadow" as string]: "#b45309" }}
            className="gs-btn-3d mt-6 w-full rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 px-4 py-4 text-lg font-black text-indigo-950 disabled:opacity-40"
          >
            {joining ? "Đang vào..." : room?.teamModeEnabled ? "Tiếp theo →" : "Tham gia →"}
          </button>
        </main>
      </div>
    );
  }

  if (phase === "team") {
    return (
      <div className={SHELL}>
        <main className="mx-auto max-w-md px-4 py-10">
          <h1 className="text-center text-2xl font-black">👥 Chọn đội của bạn</h1>
          <p className="mt-1 text-center text-sm text-white/60">{displayName}</p>

          <div className="mt-6 space-y-2.5">
            {room?.teams.map((t) => {
              const colors = teamColorClasses(t.colorKey);
              const selected = selectedTeamId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeamId(t.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border-2 p-4 text-left transition-transform active:scale-95 ${
                    selected
                      ? `border-transparent ${colors.bg} ${colors.text} scale-105 shadow-xl`
                      : "border-white/20 bg-white/10 text-white hover:bg-white/15"
                  }`}
                >
                  <span className="flex items-center gap-2 text-lg font-bold">
                    <span className="text-2xl">{emojiForColorKey(t.colorKey)}</span>
                    {t.name}
                  </span>
                  <span className={`text-xs ${selected ? "opacity-90" : "text-white/50"}`}>
                    {t.memberCount} người
                  </span>
                </button>
              );
            })}
          </div>

          {joinErr && (
            <div className="mt-4 rounded-xl border border-red-400/40 bg-red-500/20 px-3 py-2 text-sm text-red-100">
              ⚠ {joinErr}
            </div>
          )}

          <button
            onClick={onJoin}
            disabled={joining || !selectedTeamId}
            style={{ ["--gs-btn-shadow" as string]: "#b45309" }}
            className="gs-btn-3d mt-6 w-full rounded-2xl bg-gradient-to-b from-amber-400 to-orange-500 px-4 py-4 text-lg font-black text-indigo-950 disabled:opacity-40"
          >
            {joining ? "Đang vào..." : "Tham gia →"}
          </button>
        </main>
      </div>
    );
  }

  if (phase === "waiting") {
    const myTeam = room?.teams.find((t) => t.id === identity?.teamId);
    return (
      <div className={SHELL}>
        <main className="mx-auto max-w-md px-4 py-10 text-center">
          <div className="gs-bounce-in rounded-3xl bg-white/10 p-6 shadow-2xl backdrop-blur-sm">
            <span className="gs-float inline-block text-5xl">🎉</span>
            <h1 className="mt-2 text-2xl font-black">Bạn đã vào phòng!</h1>
            <p className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-white/60">
              Đang chờ giảng viên bắt đầu
              <span className="gs-glow-pulse inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-3xl">{AVATARS[identity?.avatarKey ?? "fox"]}</span>
              <span className="text-lg font-bold">{identity?.displayName}</span>
            </div>
            {myTeam && (
              <span
                className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${teamColorClasses(myTeam.colorKey).bg} ${teamColorClasses(myTeam.colorKey).text}`}
              >
                {emojiForColorKey(myTeam.colorKey)} {myTeam.name}
              </span>
            )}
          </div>

          <p className="mt-6 text-sm font-semibold text-white/70">Đổi avatar</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {AVATAR_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => onChangeAvatarInLobby(key)}
                className={`rounded-2xl border-2 p-3 text-3xl transition-transform active:scale-90 ${
                  identity?.avatarKey === key
                    ? "border-amber-400 bg-white/20"
                    : "border-transparent bg-white/10 hover:bg-white/15"
                }`}
              >
                {AVATARS[key]}
              </button>
            ))}
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-white/40">
            {participants.length} người trong phòng
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {participants.map((p, i) => (
              <span
                key={p.participantId}
                style={{ animationDelay: `${Math.min(i, 20) * 40}ms` }}
                className="gs-pop-in flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm"
              >
                <span>{AVATARS[p.avatarKey] ?? "🙂"}</span>
                <span>{p.displayName}</span>
              </span>
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (phase === "question" || phase === "answered") {
    const locked = phase === "answered";
    const twoOptions = (question?.options.length ?? 0) <= 2;
    const verdictReady = locked && (answerResult !== null || answerError !== null);
    return (
      <div className="relative flex min-h-screen flex-col bg-slate-50 text-slate-900">
        {showSplash && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <span className="gs-splash-in rounded-3xl bg-slate-900/90 px-8 py-5 text-4xl font-black text-white">
              Câu {questionIndex + 1}
            </span>
          </div>
        )}

        {phase === "question" && <LinearTimer remainingMs={remainingMs} totalMs={timeLimitMs} />}

        <main className="mx-auto flex w-full max-w-md flex-col px-4 py-5">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
              Câu {questionIndex + 1}/{questionCount}
            </span>
            {localStreak >= 1 && (
              <span className="flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-600">
                🔥 {localStreak}
              </span>
            )}
          </div>
          <h2 className="mt-4 text-center text-xl font-black leading-snug">{question?.prompt}</h2>

          {phase === "question" && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() =>
                  setPendingPowerUp((p) => (p === "double_points" ? null : "double_points"))
                }
                disabled={usedPowerUps.has("double_points")}
                className={`flex-1 rounded-xl border-2 px-2 py-2 text-xs font-bold disabled:opacity-30 ${
                  pendingPowerUp === "double_points"
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                ⚡ x2 điểm
              </button>
              <button
                onClick={() => setPendingPowerUp((p) => (p === "immunity" ? null : "immunity"))}
                disabled={usedPowerUps.has("immunity")}
                className={`flex-1 rounded-xl border-2 px-2 py-2 text-xs font-bold disabled:opacity-30 ${
                  pendingPowerUp === "immunity"
                    ? "border-amber-400 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                🛡️ Miễn nhiễm
              </button>
            </div>
          )}

          <div className={`mt-5 grid gap-4 ${twoOptions ? "grid-cols-1" : "grid-cols-2"}`}>
            {question?.options.map((o, i) => {
              const isChosen = chosenOptionId === o.id;
              let state: OptionState = "idle";
              if (locked) {
                if (isChosen) {
                  state = verdictReady ? (answerResult?.isCorrect ? "correct" : "incorrect") : "selected";
                } else {
                  state = "dimmed";
                }
              }
              return (
                <OptionCard
                  key={o.id}
                  letter={OPTION_LETTERS[i] ?? "?"}
                  label={o.label}
                  state={state}
                  onClick={() => onAnswer(o.id)}
                  disabled={locked}
                  tiltSign={i % 2 === 0 ? -1 : 1}
                />
              );
            })}
          </div>

          {phase === "answered" && (
            <p
              className={`mt-4 text-center text-sm font-semibold ${
                !verdictReady
                  ? "text-slate-400"
                  : answerError
                    ? "text-amber-600"
                    : answerResult?.isCorrect
                      ? "text-emerald-600"
                      : "text-red-500"
              }`}
            >
              {!verdictReady
                ? "Đã khoá! ⏳ Đang chờ..."
                : answerError
                  ? answerError
                  : answerResult?.isCorrect
                    ? `Chính xác! +${answerResult.pointsAwarded} điểm 🎉`
                    : answerResult && answerResult.pointsAwarded > 0
                      ? `Miễn nhiễm cứu bạn! +${answerResult.pointsAwarded} điểm`
                      : "Sai rồi — cố lên câu sau!"}
            </p>
          )}
        </main>
      </div>
    );
  }

  if (phase === "reveal") {
    const teamMode = !!room?.teamModeEnabled;
    const sorted = [...participants].sort((a, b) => b.totalScore - a.totalScore);
    return (
      <div className={SHELL}>
        <main className="mx-auto max-w-md px-4 py-6">
          {question && (
            <>
              <h2 className="text-center text-lg font-bold">{question.prompt}</h2>
              <div
                className={`mt-3 grid gap-3 ${question.options.length <= 2 ? "grid-cols-1" : "grid-cols-2"}`}
              >
                {question.options.map((o, i) => {
                  const isCorrect = o.id === correctOptionId;
                  const wasChosen = o.id === chosenOptionId;
                  const state: OptionState = isCorrect ? "correct" : wasChosen ? "incorrect" : "dimmed";
                  return (
                    <OptionCard
                      key={o.id}
                      letter={OPTION_LETTERS[i] ?? "?"}
                      label={o.label}
                      state={state}
                      disabled
                      dark
                      tiltSign={i % 2 === 0 ? -1 : 1}
                    />
                  );
                })}
              </div>
              {answerResult ? (
                <p className="mt-3 text-center text-sm font-bold text-amber-300">
                  {answerResult.pointsAwarded > 0
                    ? `+${answerResult.pointsAwarded} điểm`
                    : "Không có điểm câu này"}
                </p>
              ) : (
                answerError &&
                chosenOptionId && (
                  <p className="mt-3 text-center text-sm font-medium text-amber-300">{answerError}</p>
                )
              )}
            </>
          )}

          <h3 className="mt-6 flex items-center justify-center gap-1.5 text-sm font-bold text-white/80">
            🏆 Bảng xếp hạng
          </h3>
          {teamMode ? (
            <TeamScoreboard teamStandings={teamStandings} myTeamId={identity?.teamId ?? null} />
          ) : (
            <IndividualScoreboard sorted={sorted} myId={identity?.participantId ?? null} />
          )}
        </main>
      </div>
    );
  }

  if (phase === "ended") {
    const teamMode = !!room?.teamModeEnabled;
    return (
      <div className={SHELL}>
        <main className="mx-auto max-w-md px-4 py-8 text-center">
          <h1 className="gs-bounce-in flex items-center justify-center gap-2 text-3xl font-black">
            <Trophy className="h-8 w-8 flex-none text-amber-400" aria-hidden="true" />
            Kết thúc!
          </h1>
          <div className="mt-6">
            <Podium
              teamModeEnabled={teamMode}
              participants={participants}
              teamStandings={teamStandings}
              highlightTeamId={identity?.teamId ?? null}
              highlightParticipantId={identity?.participantId ?? null}
            />
          </div>

          <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
            <button
              onClick={() => setShowReview(true)}
              disabled={history.length === 0}
              style={{ ["--gs-btn-shadow" as string]: "#3730a3" }}
              className="gs-btn-3d rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              📋 Xem lại câu hỏi
            </button>
            <a
              href="/"
              className="gs-btn-3d rounded-2xl bg-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/25"
              style={{ ["--gs-btn-shadow" as string]: "#00000066" }}
            >
              🚪 Thoát
            </a>
          </div>
        </main>

        {showReview && (
          <div className="fixed inset-0 z-40 overflow-y-auto bg-black/80 px-4 py-8">
            <div className="mx-auto max-w-md">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-black text-white">📋 Xem lại câu hỏi</h2>
                <button
                  onClick={() => setShowReview(false)}
                  className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white hover:bg-white/20"
                >
                  Đóng ✕
                </button>
              </div>
              <ol className="mt-4 space-y-3">
                {history.map((h) => (
                  <li key={h.questionIndex} className="rounded-2xl bg-white/10 p-4 text-left text-white">
                    <p className="text-xs font-bold text-white/50">Câu {h.questionIndex + 1}</p>
                    <p className="mt-1 font-semibold">{h.prompt}</p>
                    <div className="mt-2 space-y-1.5">
                      {h.options.map((o, i) => {
                        const isCorrect = o.id === h.correctOptionId;
                        const wasChosen = o.id === h.chosenOptionId;
                        const state: OptionState = isCorrect
                          ? "correct"
                          : wasChosen
                            ? "incorrect"
                            : "dimmed";
                        return (
                          <OptionCard
                            key={o.id}
                            letter={OPTION_LETTERS[i] ?? "?"}
                            label={o.label}
                            state={state}
                            disabled
                            dark
                            compact
                            tiltSign={i % 2 === 0 ? -1 : 1}
                          />
                        );
                      })}
                    </div>
                    <p
                      className={`mt-2 text-xs font-bold ${h.isCorrect ? "text-emerald-300" : "text-red-300"}`}
                    >
                      {h.isCorrect === null
                        ? "Không trả lời"
                        : h.isCorrect
                          ? `Đúng · +${h.pointsAwarded} điểm`
                          : "Sai"}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function TeamScoreboard({
  teamStandings,
  myTeamId,
}: {
  teamStandings: TeamStanding[];
  myTeamId: string | null;
}) {
  const top5 = teamStandings.slice(0, 5);
  const deltas = useRankDeltas(top5.map((t) => t.teamId));
  return (
    <ol className="mt-3 space-y-2">
      {top5.map((t, i) => (
        <ScoreRow
          key={t.teamId}
          rank={i + 1}
          label={`${emojiForColorKey(t.colorKey)} ${t.name}`}
          score={t.avgScore}
          delta={deltas.get(t.teamId)}
          mine={myTeamId === t.teamId}
          colorClass={`${teamColorClasses(t.colorKey).bg} ${teamColorClasses(t.colorKey).text}`}
        />
      ))}
      {teamStandings.length === 0 && <p className="text-center text-xs text-white/40">Chưa có dữ liệu</p>}
    </ol>
  );
}

function IndividualScoreboard({ sorted, myId }: { sorted: LiveParticipant[]; myId: string | null }) {
  const top5 = sorted.slice(0, 5);
  const deltas = useRankDeltas(top5.map((p) => p.participantId));
  return (
    <ol className="mt-3 space-y-2">
      {top5.map((p, i) => (
        <ScoreRow
          key={p.participantId}
          rank={i + 1}
          label={`${AVATARS[p.avatarKey] ?? "🙂"} ${p.displayName}`}
          score={p.totalScore}
          delta={deltas.get(p.participantId)}
          mine={myId === p.participantId}
          streak={p.streak}
        />
      ))}
      {sorted.length === 0 && <p className="text-center text-xs text-white/40">Chưa có dữ liệu</p>}
    </ol>
  );
}

function ScoreRow({
  rank,
  label,
  score,
  delta,
  mine,
  streak,
  colorClass,
}: {
  rank: number;
  label: string;
  score: number;
  delta: number | undefined;
  mine: boolean;
  streak?: number;
  colorClass?: string;
}) {
  const shown = useCountUp(score);
  return (
    <li
      className={`gs-slide-fade-in flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
        colorClass ?? "bg-white/10"
      } ${mine ? "ring-2 ring-white" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-2 font-semibold">
        <span className="w-4 flex-none text-right text-xs opacity-70">{rank}</span>
        <span className="truncate">{label}</span>
        {!!streak && streak >= 2 && (
          <span className="flex-none rounded-full bg-black/25 px-1.5 py-0.5 text-[10px] font-bold">
            🔥{streak}
          </span>
        )}
        {!!delta &&
          (delta > 0 ? (
            <span className="flex-none text-[10px] font-bold text-emerald-300">🔼{delta}</span>
          ) : (
            <span className="flex-none text-[10px] font-bold text-red-300">🔻{Math.abs(delta)}</span>
          ))}
      </span>
      <span className="flex-none font-black tabular-nums">{shown}</span>
    </li>
  );
}
