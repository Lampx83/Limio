"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export type OralAttemptLive = {
  attemptId: string;
  userName: string | null;
  status: "in_progress" | "submitted" | "auto_submitted" | "graded" | "flagged";
  startedAt: number;
  expiresAt: number;
  submittedAt: number | null;
  questionsAsked: number;
  totalQuestions: number;
  incidentCount: number;
  lastSeenAt: number;
};

type WireAttempt = Omit<OralAttemptLive, "questionsAsked"> & {
  answeredQuestionIds?: string[];
};

type Event =
  | { type: "snapshot"; attempts: WireAttempt[] }
  | { type: "attempt.started"; attempt: WireAttempt }
  | { type: "attempt.heartbeat"; attemptId: string; at: number }
  | { type: "attempt.answered"; attemptId: string; questionId: string; at: number }
  | { type: "attempt.incident"; attemptId: string; incidentType: string; incidentCount: number; at: number }
  | { type: "attempt.status"; attemptId: string; status: OralAttemptLive["status"]; at: number }
  | { type: "ping" };

const STATUS_LABEL: Record<OralAttemptLive["status"], string> = {
  in_progress: "Đang thi",
  submitted: "Đã nộp",
  auto_submitted: "Hết giờ",
  graded: "Đã chấm",
  flagged: "Gắn cờ",
};
const STATUS_TONE: Record<OralAttemptLive["status"], string> = {
  in_progress: "bg-emerald-100 text-emerald-800",
  submitted: "bg-blue-100 text-blue-800",
  auto_submitted: "bg-amber-100 text-amber-800",
  graded: "bg-slate-100 text-slate-700",
  flagged: "bg-red-100 text-red-800",
};

const NowContext = createContext(0);
const useNow = () => useContext(NowContext);

function normalize(a: WireAttempt): OralAttemptLive {
  const { answeredQuestionIds, ...rest } = a;
  return { ...rest, questionsAsked: answeredQuestionIds?.length ?? 0 };
}

type Filter = "all" | "in_progress" | "submitted" | "stale";

export default function OralLiveDashboard({
  courseId,
  examId,
  initial,
}: {
  courseId: string;
  examId: string;
  initial: OralAttemptLive[];
}) {
  const [attempts, setAttempts] = useState<Record<string, OralAttemptLive>>(() =>
    Object.fromEntries(initial.map((a) => [a.attemptId, a])),
  );
  const [connState, setConnState] = useState<"connecting" | "open" | "closed">("connecting");
  const [filter, setFilter] = useState<Filter>("all");
  const [now, setNow] = useState(() => Date.now());
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
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
      setAttempts((prev) => {
        if (ev.type === "snapshot") {
          return Object.fromEntries(ev.attempts.map((a) => [a.attemptId, normalize(a)]));
        }
        if (ev.type === "attempt.started") {
          return { ...prev, [ev.attempt.attemptId]: normalize(ev.attempt) };
        }
        const cur = prev[ev.attemptId];
        if (!cur) return prev;
        if (ev.type === "attempt.heartbeat") {
          return { ...prev, [ev.attemptId]: { ...cur, lastSeenAt: ev.at } };
        }
        if (ev.type === "attempt.answered") {
          return {
            ...prev,
            [ev.attemptId]: { ...cur, questionsAsked: cur.questionsAsked + 1, lastSeenAt: ev.at },
          };
        }
        if (ev.type === "attempt.incident") {
          return {
            ...prev,
            [ev.attemptId]: { ...cur, incidentCount: ev.incidentCount, lastSeenAt: ev.at },
          };
        }
        if (ev.type === "attempt.status") {
          return {
            ...prev,
            [ev.attemptId]: {
              ...cur,
              status: ev.status,
              submittedAt: ev.status !== "in_progress" ? ev.at : cur.submittedAt,
            },
          };
        }
        return prev;
      });
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [examId]);

  const list = useMemo(() => {
    const arr = Object.values(attempts).sort((a, b) => a.startedAt - b.startedAt);
    if (filter === "all") return arr;
    if (filter === "in_progress") return arr.filter((a) => a.status === "in_progress");
    if (filter === "submitted")
      return arr.filter((a) => a.status === "submitted" || a.status === "auto_submitted" || a.status === "graded");
    return arr.filter((a) => a.status === "in_progress" && now - a.lastSeenAt > 60_000);
  }, [attempts, filter, now]);

  const counts = useMemo(() => {
    const arr = Object.values(attempts);
    return {
      total: arr.length,
      inProgress: arr.filter((a) => a.status === "in_progress").length,
      submitted: arr.filter((a) => a.status !== "in_progress").length,
      stale: arr.filter((a) => a.status === "in_progress" && now - a.lastSeenAt > 60_000).length,
    };
  }, [attempts, now]);

  return (
    <NowContext.Provider value={now}>
      <div className="mt-6">
        <div className="flex flex-wrap items-center gap-3">
          <ConnBadge state={connState} />
          <Pill onClick={() => setFilter("all")} active={filter === "all"}>
            Tất cả ({counts.total})
          </Pill>
          <Pill onClick={() => setFilter("in_progress")} active={filter === "in_progress"}>
            Đang thi ({counts.inProgress})
          </Pill>
          <Pill onClick={() => setFilter("submitted")} active={filter === "submitted"}>
            Đã nộp ({counts.submitted})
          </Pill>
          <Pill onClick={() => setFilter("stale")} active={filter === "stale"} tone="red">
            Mất kết nối ({counts.stale})
          </Pill>
        </div>

        {list.length === 0 ? (
          <p className="mt-6 rounded border border-dashed border-default px-4 py-6 text-center text-sm text-faint">
            Chưa có sinh viên nào trong bộ lọc này.
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a) => (
              <AttemptCard key={a.attemptId} a={a} courseId={courseId} examId={examId} />
            ))}
          </ul>
        )}
      </div>
    </NowContext.Provider>
  );
}

function AttemptCard({
  a,
  courseId,
  examId,
}: {
  a: OralAttemptLive;
  courseId: string;
  examId: string;
}) {
  const now = useNow();
  const stale = a.status === "in_progress" && now - a.lastSeenAt > 60_000;
  const remainingSec = Math.max(0, Math.floor((a.expiresAt - now) / 1000));
  const minutes = Math.floor(remainingSec / 60);
  const seconds = remainingSec % 60;
  // Không có tổng số câu để so — thanh tiến độ theo thời gian đã trôi của buổi.
  const totalMs = Math.max(1, a.expiresAt - a.startedAt);
  const elapsedPct = Math.min(100, Math.max(0, ((a.status === "in_progress" ? now : (a.submittedAt ?? now)) - a.startedAt) / totalMs * 100));

  return (
    <li className={`rounded-lg border bg-white p-4 ${stale ? "border-red-300" : "border-default"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{a.userName ?? "Sinh viên"}</p>
          {stale && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-red-700">
              <AlertTriangle size={12} /> Mất kết nối
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] ${STATUS_TONE[a.status]}`}>
          {STATUS_LABEL[a.status]}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-faint">
        <span>Đã hỏi {a.questionsAsked} câu</span>
        {a.status === "in_progress" && <span className="tabular-nums">{String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}</span>}
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${elapsedPct}%` }}
        />
      </div>

      {a.incidentCount > 0 && (
        <p className="mt-2 flex items-center gap-1 text-xs text-amber-700">
          <AlertTriangle size={12} /> {a.incidentCount} cảnh báo (rời tab/thoát fullscreen…)
        </p>
      )}

      {a.status !== "in_progress" && (
        <Link
          href={`/instructor/courses/${courseId}/exams/${examId}/grading/${a.attemptId}`}
          className="mt-3 inline-block text-xs font-medium text-blue-600 hover:underline"
        >
          Xem & chấm bài →
        </Link>
      )}
    </li>
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
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs">
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
  const base = "rounded-full px-3 py-1 text-xs font-medium transition-colors border";
  const activeCls =
    tone === "red"
      ? "border-red-300 bg-red-100 text-red-800"
      : "border-brand-300 bg-brand-100 text-brand-800";
  const inactiveCls = "border-default bg-white text-faint hover:bg-slate-50";
  return (
    <button type="button" onClick={onClick} className={`${base} ${active ? activeCls : inactiveCls}`}>
      {children}
    </button>
  );
}
