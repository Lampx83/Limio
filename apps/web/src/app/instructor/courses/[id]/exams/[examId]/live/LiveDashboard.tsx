"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AttemptLive = {
  attemptId: string;
  userId: string | null;
  userName: string | null;
  subjectType: "user" | "open" | "assigned";
  status: "in_progress" | "submitted" | "auto_submitted" | "graded" | "flagged";
  startedAt: number;
  expiresAt: number;
  submittedAt: number | null;
  answeredQuestionIds: string[];
  totalQuestions: number;
  incidentCount: number;
  lastSeenAt: number;
  resumeCount: number;
};

type Event =
  | { type: "snapshot"; attempts: AttemptLive[] }
  | { type: "attempt.started"; attempt: AttemptLive }
  | { type: "attempt.heartbeat"; attemptId: string; at: number }
  | { type: "attempt.answered"; attemptId: string; questionId: string; at: number }
  | { type: "attempt.incident"; attemptId: string; incidentType: string; incidentCount: number; at: number }
  | { type: "attempt.status"; attemptId: string; status: AttemptLive["status"]; at: number }
  | { type: "attempt.claimed"; attemptId: string; at: number; resumeCount: number }
  | {
      type: "attempt.extended";
      attemptId: string;
      newDurationSec: number;
      newExpiresAt: number;
      at: number;
    }
  | { type: "message.sent"; attemptId: string; messageId: string; body: string; at: number }
  | { type: "message.broadcast"; examId: string; messageId: string; body: string; at: number }
  | { type: "attempt.heartbeat_lost"; attemptId: string; lostForMs: number; at: number }
  | { type: "ping" };

type Filter = "all" | "in_progress" | "submitted" | "stale";
type TypeFilter = "all" | "user" | "open" | "assigned";

const SUBJECT_LABEL: Record<AttemptLive["subjectType"], string> = {
  user: "Logged-in",
  open: "Open",
  assigned: "Assigned",
};
const SUBJECT_TONE: Record<AttemptLive["subjectType"], string> = {
  user: "bg-slate-100 text-slate-700",
  open: "bg-purple-100 text-purple-800",
  assigned: "bg-indigo-100 text-indigo-800",
};

const STATUS_LABEL: Record<AttemptLive["status"], string> = {
  in_progress: "Đang thi",
  submitted: "Đã nộp",
  auto_submitted: "Hết giờ",
  graded: "Đã chấm",
  flagged: "Gắn cờ",
};
const STATUS_TONE: Record<AttemptLive["status"], string> = {
  in_progress: "bg-emerald-100 text-emerald-800",
  submitted: "bg-blue-100 text-blue-800",
  auto_submitted: "bg-amber-100 text-amber-800",
  graded: "bg-slate-100 text-slate-700",
  flagged: "bg-red-100 text-red-800",
};

export type ExamQuestionRef = { id: string; order: number };

export default function LiveDashboard({
  examId,
  initial,
  questions,
}: {
  examId: string;
  initial: AttemptLive[];
  questions: ExamQuestionRef[];
}) {
  const [attempts, setAttempts] = useState<Record<string, AttemptLive>>(() =>
    Object.fromEntries(initial.map((a) => [a.attemptId, a])),
  );
  const [connState, setConnState] = useState<"connecting" | "open" | "closed">(
    "connecting",
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [now, setNow] = useState(() => Date.now());
  const esRef = useRef<EventSource | null>(null);

  // Tick clock every second for live countdown + staleness colors.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const es = new EventSource(`/api/exams/${examId}/live`);
    esRef.current = es;
    es.onopen = () => setConnState("open");
    es.onerror = () => setConnState("closed");
    es.onmessage = (m) => {
      let ev: Event;
      try {
        ev = JSON.parse(m.data) as Event;
      } catch {
        return;
      }
      if (ev.type === "ping") return;
      setAttempts((prev) => applyEvent(prev, ev));
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [examId]);

  const list = useMemo(() => {
    let arr = Object.values(attempts);
    arr.sort((a, b) => a.startedAt - b.startedAt);
    if (typeFilter !== "all") arr = arr.filter((a) => a.subjectType === typeFilter);
    if (filter === "all") return arr;
    if (filter === "in_progress")
      return arr.filter((a) => a.status === "in_progress");
    if (filter === "submitted")
      return arr.filter(
        (a) => a.status === "submitted" || a.status === "auto_submitted",
      );
    // stale = in-progress + last seen > 60s
    return arr.filter(
      (a) => a.status === "in_progress" && now - a.lastSeenAt > 60_000,
    );
  }, [attempts, filter, typeFilter, now]);

  const counts = useMemo(() => {
    const arr = Object.values(attempts);
    return {
      total: arr.length,
      inProgress: arr.filter((a) => a.status === "in_progress").length,
      submitted: arr.filter(
        (a) => a.status === "submitted" || a.status === "auto_submitted",
      ).length,
      stale: arr.filter(
        (a) => a.status === "in_progress" && now - a.lastSeenAt > 60_000,
      ).length,
      incidents: arr.reduce((s, a) => s + a.incidentCount, 0),
      types: {
        user: arr.filter((a) => a.subjectType === "user").length,
        open: arr.filter((a) => a.subjectType === "open").length,
        assigned: arr.filter((a) => a.subjectType === "assigned").length,
      },
    };
  }, [attempts, now]);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <ConnBadge state={connState} />
        <Pill onClick={() => setFilter("all")} active={filter === "all"}>
          Tất cả ({counts.total})
        </Pill>
        <Pill
          onClick={() => setFilter("in_progress")}
          active={filter === "in_progress"}
        >
          Đang thi ({counts.inProgress})
        </Pill>
        <Pill
          onClick={() => setFilter("submitted")}
          active={filter === "submitted"}
        >
          Đã nộp ({counts.submitted})
        </Pill>
        <Pill
          onClick={() => setFilter("stale")}
          active={filter === "stale"}
          tone="red"
        >
          Mất kết nối ({counts.stale})
        </Pill>
        <BroadcastButton examId={examId} />
        <span className="ml-auto text-xs text-faint">
          Tổng incident: <b>{counts.incidents}</b>
        </span>
      </div>

      {/* A5.8.D5 — Subject type filter. Hidden if all attempts are User-only. */}
      {(counts.types.open > 0 || counts.types.assigned > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-faint">Loại:</span>
          <Pill onClick={() => setTypeFilter("all")} active={typeFilter === "all"}>
            Tất cả
          </Pill>
          <Pill onClick={() => setTypeFilter("user")} active={typeFilter === "user"}>
            Logged-in ({counts.types.user})
          </Pill>
          <Pill onClick={() => setTypeFilter("open")} active={typeFilter === "open"}>
            Open ({counts.types.open})
          </Pill>
          <Pill
            onClick={() => setTypeFilter("assigned")}
            active={typeFilter === "assigned"}
          >
            Assigned ({counts.types.assigned})
          </Pill>
        </div>
      )}

      {list.length === 0 && (
        <div
          data-testid="empty-state"
          className="mt-6 rounded-lg border border-dashed border-default p-8 text-center text-sm text-faint"
        >
          Chưa có sinh viên nào thi trong 24h qua.
        </div>
      )}

      {list.length > 0 && (
        <div
          className="mt-6 grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          }}
        >
          {list.map((a) => (
            <AttemptCard
              key={a.attemptId}
              a={a}
              now={now}
              questions={questions}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function applyEvent(
  prev: Record<string, AttemptLive>,
  ev: Event,
): Record<string, AttemptLive> {
  if (ev.type === "snapshot") {
    const next = { ...prev };
    for (const a of ev.attempts) next[a.attemptId] = a;
    return next;
  }
  if (ev.type === "attempt.started") {
    return { ...prev, [ev.attempt.attemptId]: ev.attempt };
  }
  // Message events don't mutate attempt state; the dashboard just shows them
  // as a confirmation toast handled elsewhere.
  if (ev.type === "message.sent" || ev.type === "message.broadcast") {
    return prev;
  }
  if (ev.type === "attempt.heartbeat_lost") {
    const existing0 = prev[ev.attemptId];
    if (!existing0) return prev;
    // Snap lastSeenAt back so the live dot turns red immediately, without
    // waiting for the dashboard's local clock to cross 60s.
    return {
      ...prev,
      [ev.attemptId]: {
        ...existing0,
        lastSeenAt: ev.at - ev.lostForMs,
      },
    };
  }
  const existing = prev[ev.type === "ping" ? "" : (ev as { attemptId: string }).attemptId];
  if (!existing) return prev;
  if (ev.type === "attempt.heartbeat") {
    return {
      ...prev,
      [ev.attemptId]: { ...existing, lastSeenAt: ev.at },
    };
  }
  if (ev.type === "attempt.answered") {
    const has = existing.answeredQuestionIds.includes(ev.questionId);
    return {
      ...prev,
      [ev.attemptId]: {
        ...existing,
        answeredQuestionIds: has
          ? existing.answeredQuestionIds
          : [...existing.answeredQuestionIds, ev.questionId],
        lastSeenAt: ev.at,
      },
    };
  }
  if (ev.type === "attempt.incident") {
    return {
      ...prev,
      [ev.attemptId]: {
        ...existing,
        incidentCount: ev.incidentCount,
        lastSeenAt: ev.at,
      },
    };
  }
  if (ev.type === "attempt.status") {
    return {
      ...prev,
      [ev.attemptId]: {
        ...existing,
        status: ev.status,
        submittedAt: ev.status !== "in_progress" ? ev.at : existing.submittedAt,
      },
    };
  }
  if (ev.type === "attempt.claimed") {
    return {
      ...prev,
      [ev.attemptId]: {
        ...existing,
        resumeCount: ev.resumeCount,
        lastSeenAt: ev.at,
      },
    };
  }
  if (ev.type === "attempt.extended") {
    return {
      ...prev,
      [ev.attemptId]: {
        ...existing,
        expiresAt: ev.newExpiresAt,
      },
    };
  }
  return prev;
}

function AttemptCard({
  a,
  now,
  questions,
}: {
  a: AttemptLive;
  now: number;
  questions: ExamQuestionRef[];
}) {
  const remainingMs = Math.max(0, a.expiresAt - now);
  const sinceSeen = Math.max(0, now - a.lastSeenAt);
  const answeredSet = new Set(a.answeredQuestionIds);
  const answeredCount = a.answeredQuestionIds.length;
  const progressPct =
    a.totalQuestions > 0
      ? Math.round((answeredCount / a.totalQuestions) * 100)
      : 0;

  const liveDot =
    a.status !== "in_progress"
      ? "bg-slate-300"
      : sinceSeen < 15_000
        ? "bg-emerald-500 animate-pulse"
        : sinceSeen < 60_000
          ? "bg-amber-500"
          : "bg-red-500";

  return (
    <div
      data-testid={`attempt-card-${a.attemptId}`}
      className="rounded-lg border border-default bg-white p-3 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${liveDot}`} />
        <a
          href={`${typeof window !== "undefined" ? window.location.pathname : ""}/${a.attemptId}`}
          className="min-w-0 flex-1 truncate text-sm font-semibold hover:text-blue-700 hover:underline"
        >
          {a.userName ?? a.userId?.slice(0, 8) ?? a.attemptId.slice(0, 8)}
        </a>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] ${SUBJECT_TONE[a.subjectType]}`}
          title={`Loại thí sinh: ${SUBJECT_LABEL[a.subjectType]}`}
        >
          {SUBJECT_LABEL[a.subjectType]}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-[11px] ${STATUS_TONE[a.status]}`}
        >
          {STATUS_LABEL[a.status]}
        </span>
      </div>

      <div className="mt-2 text-xs text-faint">
        Last ping: {fmtAgo(sinceSeen)}
        {a.resumeCount > 0 && (
          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5">
            resume×{a.resumeCount}
          </span>
        )}
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between text-xs text-slate-700">
          <span>
            {answeredCount}/{a.totalQuestions} câu
          </span>
          <span>{progressPct}%</span>
        </div>
        {questions.length > 0 && (
          <div
            data-testid="question-dots"
            className="mt-1.5 flex flex-wrap gap-1"
            role="list"
            aria-label="Tiến độ từng câu hỏi"
          >
            {questions.map((q, i) => {
              const done = answeredSet.has(q.id);
              return (
                <span
                  key={q.id}
                  role="listitem"
                  title={`Câu ${i + 1}: ${done ? "đã trả lời" : "chưa trả lời"}`}
                  className={`inline-block h-3 w-3 rounded-full ${
                    done ? "bg-emerald-500" : "bg-slate-300"
                  }`}
                  data-answered={done ? "true" : "false"}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-faint">
          {a.status === "in_progress" ? "Còn lại" : "Đã nộp lúc"}
        </span>
        <span
          className={`font-mono ${
            a.status === "in_progress" && remainingMs < 60_000
              ? "text-red-600"
              : "text-slate-700"
          }`}
        >
          {a.status === "in_progress"
            ? fmtCountdown(remainingMs)
            : a.submittedAt
              ? fmtAgo(now - a.submittedAt)
              : "—"}
        </span>
      </div>

      {a.incidentCount > 0 && (
        <div className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-800">
          ⚠ {a.incidentCount} incident
        </div>
      )}

      <ActionMenu a={a} />
    </div>
  );
}

function ActionMenu({ a }: { a: AttemptLive }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const call = async (
    label: string,
    fn: () => Promise<Response>,
    confirmMsg?: string,
  ) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(label);
    setErr(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const inProgress = a.status === "in_progress";

  return (
    <div className="mt-3 border-t border-default pt-2">
      <div className="flex flex-wrap gap-1">
        <ActionBtn
          disabled={!inProgress || busy !== null}
          loading={busy === "extend"}
          onClick={() =>
            call(
              "extend",
              () =>
                fetch(`/api/exam-attempts/${a.attemptId}/extend`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ minutes: 5 }),
                }),
              `Gia hạn +5 phút cho ${a.userName ?? "sinh viên này"}?`,
            )
          }
        >
          +5p
        </ActionBtn>
        <ActionBtn
          disabled={!inProgress || busy !== null}
          loading={busy === "reset"}
          onClick={() =>
            call(
              "reset",
              () =>
                fetch(`/api/exam-attempts/${a.attemptId}/reset-session`, {
                  method: "POST",
                }),
              `Reset session lock? Sinh viên cần claim lại từ tab hiện tại.`,
            )
          }
        >
          Reset session
        </ActionBtn>
        <ActionBtn
          disabled={!inProgress || busy !== null}
          loading={busy === "force"}
          tone="amber"
          onClick={() =>
            call("force", () => {
              const reason = window.prompt("Lý do force submit?")?.trim();
              if (!reason) return Promise.resolve(new Response(null, { status: 0 }));
              return fetch(`/api/exam-attempts/${a.attemptId}/force-submit`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ reason }),
              });
            })
          }
        >
          Force submit
        </ActionBtn>
        <ActionBtn
          disabled={a.status === "flagged" || busy !== null}
          loading={busy === "dq"}
          tone="red"
          onClick={() =>
            call("dq", () => {
              const reason = window.prompt("Lý do disqualify?")?.trim();
              if (!reason) return Promise.resolve(new Response(null, { status: 0 }));
              return fetch(`/api/exam-attempts/${a.attemptId}/disqualify`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ reason }),
              });
            })
          }
        >
          Disqualify
        </ActionBtn>
        <ActionBtn
          disabled={!inProgress || busy !== null}
          loading={busy === "msg"}
          onClick={() =>
            call("msg", () => {
              const text = window.prompt("Tin nhắn gửi sinh viên (≤500 ký tự):")?.trim();
              if (!text) return Promise.resolve(new Response(null, { status: 0 }));
              return fetch(`/api/exam-attempts/${a.attemptId}/messages`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ body: text }),
              });
            })
          }
        >
          💬 Message
        </ActionBtn>
      </div>
      {err && (
        <div className="mt-1 text-[11px] text-red-700" data-testid="action-error">
          ⚠ {err}
        </div>
      )}
    </div>
  );
}

function BroadcastButton({ examId }: { examId: string }) {
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const onClick = async () => {
    const text = window.prompt(
      "Broadcast cho toàn bộ sinh viên đang thi (≤500 ký tự):",
    )?.trim();
    if (!text) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/exams/${examId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setFlash(res.ok ? "Đã gửi" : `Lỗi: ${j?.error ?? res.status}`);
      setTimeout(() => setFlash(null), 3000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex items-center gap-2">
      <button
        data-testid="broadcast-btn"
        onClick={onClick}
        disabled={busy}
        className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-40"
      >
        📢 Broadcast
      </button>
      {flash && (
        <span className="text-[11px] text-slate-600">{flash}</span>
      )}
    </span>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  loading,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "amber" | "red";
}) {
  const base =
    "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const cls =
    tone === "red"
      ? "border-red-300 bg-red-50 text-red-800 hover:bg-red-100"
      : tone === "amber"
        ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
        : "border-default bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${cls}`}
    >
      {loading ? "…" : children}
    </button>
  );
}

function ConnBadge({ state }: { state: "connecting" | "open" | "closed" }) {
  const map = {
    connecting: { dot: "bg-amber-500 animate-pulse", label: "Đang kết nối…" },
    open: { dot: "bg-emerald-500 animate-pulse", label: "Live" },
    closed: { dot: "bg-red-500", label: "Mất kết nối" },
  } as const;
  const m = map[state];
  return (
    <span
      data-testid="conn-badge"
      className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs"
    >
      <span className={`h-2 w-2 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

function Pill({
  children,
  active,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tone?: "red";
}) {
  const base =
    "rounded-full px-3 py-1 text-xs font-medium transition-colors border";
  const activeCls =
    tone === "red"
      ? "border-red-300 bg-red-100 text-red-800"
      : "border-blue-300 bg-blue-100 text-blue-800";
  const idle = "border-default bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button onClick={onClick} className={`${base} ${active ? activeCls : idle}`}>
      {children}
    </button>
  );
}

function fmtCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  if (hh > 0)
    return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function fmtAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 5) return "vừa xong";
  if (s < 60) return `${s}s trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}p trước`;
  const h = Math.floor(m / 60);
  return `${h}h trước`;
}
