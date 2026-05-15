"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Megaphone, MessageSquare, RefreshCw } from "lucide-react";

type AttemptStatus =
  | "in_progress"
  | "submitted"
  | "auto_submitted"
  | "graded"
  | "flagged";

type AttemptCore = {
  attemptId: string;
  userId: string | null;
  userName: string;
  status: AttemptStatus;
  startedAt: number;
  expiresAt: number;
  submittedAt: number | null;
  resumeCount: number;
  lastSeenAt: number;
  score: number | null;
  scorePct: number | null;
  passed: boolean | null;
  answeredQuestionIds: string[];
  totalQuestions: number;
};

type QuestionRef = {
  id: string;
  order: number;
  prompt: string;
  answeredAt: number | null;
};

type IncidentEntry = {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  at: number;
};

type MessageEntry = {
  id: string;
  kind: "direct" | "broadcast";
  body: string;
  at: number;
};

type TimelineEntry =
  | { id: string; at: number; kind: "started" }
  | { id: string; at: number; kind: "answer"; questionOrder: number; questionId: string }
  | { id: string; at: number; kind: "incident"; iType: string; payload: Record<string, unknown> | null }
  | { id: string; at: number; kind: "message"; mKind: "direct" | "broadcast"; body: string }
  | { id: string; at: number; kind: "status"; newStatus: AttemptStatus }
  | { id: string; at: number; kind: "extended"; newExpiresAt: number }
  | { id: string; at: number; kind: "session_reset"; resumeCount: number }
  | { id: string; at: number; kind: "submitted" };

type SseEvent =
  | { type: "snapshot" }
  | { type: "attempt.heartbeat"; attemptId: string; at: number }
  | { type: "attempt.answered"; attemptId: string; questionId: string; at: number }
  | { type: "attempt.incident"; attemptId: string; incidentType: string; incidentCount: number; at: number }
  | { type: "attempt.status"; attemptId: string; status: AttemptStatus; at: number }
  | { type: "attempt.extended"; attemptId: string; newExpiresAt: number; at: number }
  | { type: "attempt.claimed"; attemptId: string; resumeCount: number; at: number }
  | { type: "message.sent"; attemptId: string; messageId: string; body: string; at: number }
  | { type: "message.broadcast"; examId: string; messageId: string; body: string; at: number }
  | { type: "attempt.heartbeat_lost"; attemptId: string; lostForMs: number; at: number }
  | { type: "ping" };

const STATUS_LABEL: Record<AttemptStatus, string> = {
  in_progress: "Đang thi",
  submitted: "Đã nộp",
  auto_submitted: "Hết giờ",
  graded: "Đã chấm",
  flagged: "Gắn cờ",
};
const STATUS_TONE: Record<AttemptStatus, string> = {
  in_progress: "bg-emerald-100 text-emerald-800",
  submitted: "bg-blue-100 text-blue-800",
  auto_submitted: "bg-amber-100 text-amber-800",
  graded: "bg-slate-100 text-slate-700",
  flagged: "bg-red-100 text-red-800",
};

const PATTERN_FLAG_LABEL: Record<string, string> = {
  speed_run: "Nộp quá nhanh",
  paste_flood: "Dán liên tục",
};

const INCIDENT_LABEL: Record<string, string> = {
  tab_blur: "Rời tab",
  fullscreen_exit: "Thoát toàn màn hình",
  paste: "Dán",
  multi_tab: "Mở nhiều tab",
  network_lost: "Mất mạng",
  multi_face: "Nhiều khuôn mặt",
};

export default function AttemptDetailLive({
  initial,
  examId,
  questions,
  initialIncidents,
  initialMessages,
  patternFlags,
  incidentCounts,
}: {
  initial: AttemptCore;
  examId: string;
  questions: QuestionRef[];
  initialIncidents: IncidentEntry[];
  initialMessages: MessageEntry[];
  patternFlags: string[];
  incidentCounts: Record<string, number>;
}) {
  const [a, setA] = useState<AttemptCore>(initial);
  const [incidents, setIncidents] = useState<IncidentEntry[]>(initialIncidents);
  const [messages, setMessages] = useState<MessageEntry[]>(initialMessages);
  const [answeredEvents, setAnsweredEvents] = useState<
    { questionId: string; at: number }[]
  >(() =>
    questions
      .filter((q) => q.answeredAt !== null)
      .map((q) => ({ questionId: q.id, at: q.answeredAt as number })),
  );
  const [statusChanges, setStatusChanges] = useState<
    { at: number; newStatus: AttemptStatus }[]
  >([]);
  const [extensions, setExtensions] = useState<
    { at: number; newExpiresAt: number }[]
  >([]);
  const [sessionResets, setSessionResets] = useState<
    { at: number; resumeCount: number }[]
  >([]);
  const [now, setNow] = useState(() => Date.now());
  const [connState, setConnState] = useState<"connecting" | "open" | "closed">(
    "connecting",
  );

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const es = new EventSource(`/api/exams/${examId}/live`);
    es.onopen = () => setConnState("open");
    es.onerror = () => setConnState("closed");
    es.onmessage = (m) => {
      let ev: SseEvent;
      try {
        ev = JSON.parse(m.data) as SseEvent;
      } catch {
        return;
      }
      if (ev.type === "ping" || ev.type === "snapshot") return;

      // Filter to this attempt; broadcasts apply to the whole exam.
      if (ev.type !== "message.broadcast" && "attemptId" in ev) {
        if (ev.attemptId !== a.attemptId) return;
      }

      if (ev.type === "attempt.heartbeat") {
        setA((s) => ({ ...s, lastSeenAt: ev.at }));
      } else if (ev.type === "attempt.heartbeat_lost") {
        setA((s) => ({ ...s, lastSeenAt: ev.at - ev.lostForMs }));
      } else if (ev.type === "attempt.answered") {
        setA((s) => ({
          ...s,
          lastSeenAt: ev.at,
          answeredQuestionIds: s.answeredQuestionIds.includes(ev.questionId)
            ? s.answeredQuestionIds
            : [...s.answeredQuestionIds, ev.questionId],
        }));
        setAnsweredEvents((prev) =>
          prev.some((x) => x.questionId === ev.questionId)
            ? prev
            : [...prev, { questionId: ev.questionId, at: ev.at }],
        );
      } else if (ev.type === "attempt.incident") {
        setIncidents((prev) => [
          ...prev,
          {
            id: `live-${ev.at}`,
            type: ev.incidentType,
            payload: null,
            at: ev.at,
          },
        ]);
      } else if (ev.type === "attempt.status") {
        setA((s) => ({
          ...s,
          status: ev.status,
          submittedAt:
            ev.status !== "in_progress" ? ev.at : s.submittedAt,
        }));
        setStatusChanges((p) => [...p, { at: ev.at, newStatus: ev.status }]);
      } else if (ev.type === "attempt.extended") {
        setA((s) => ({ ...s, expiresAt: ev.newExpiresAt }));
        setExtensions((p) => [
          ...p,
          { at: ev.at, newExpiresAt: ev.newExpiresAt },
        ]);
      } else if (ev.type === "attempt.claimed") {
        setA((s) => ({ ...s, resumeCount: ev.resumeCount, lastSeenAt: ev.at }));
        setSessionResets((p) => [
          ...p,
          { at: ev.at, resumeCount: ev.resumeCount },
        ]);
      } else if (ev.type === "message.sent" || ev.type === "message.broadcast") {
        setMessages((prev) =>
          prev.some((m) => m.id === ev.messageId)
            ? prev
            : [
                ...prev,
                {
                  id: ev.messageId,
                  kind: ev.type === "message.broadcast" ? "broadcast" : "direct",
                  body: ev.body,
                  at: ev.at,
                },
              ],
        );
      }
    };
    return () => es.close();
  }, [examId, a.attemptId]);

  const timeline = useMemo<TimelineEntry[]>(() => {
    const items: TimelineEntry[] = [];
    items.push({ id: "started", at: a.startedAt, kind: "started" });
    const orderOf = new Map(questions.map((q) => [q.id, q.order]));
    for (const e of answeredEvents) {
      items.push({
        id: `ans-${e.questionId}-${e.at}`,
        at: e.at,
        kind: "answer",
        questionId: e.questionId,
        questionOrder: orderOf.get(e.questionId) ?? 0,
      });
    }
    for (const i of incidents) {
      items.push({
        id: `inc-${i.id}`,
        at: i.at,
        kind: "incident",
        iType: i.type,
        payload: i.payload,
      });
    }
    for (const m of messages) {
      items.push({
        id: `msg-${m.id}`,
        at: m.at,
        kind: "message",
        mKind: m.kind,
        body: m.body,
      });
    }
    for (const s of statusChanges) {
      items.push({
        id: `st-${s.at}`,
        at: s.at,
        kind: "status",
        newStatus: s.newStatus,
      });
    }
    for (const e of extensions) {
      items.push({
        id: `ext-${e.at}`,
        at: e.at,
        kind: "extended",
        newExpiresAt: e.newExpiresAt,
      });
    }
    for (const r of sessionResets) {
      items.push({
        id: `rs-${r.at}`,
        at: r.at,
        kind: "session_reset",
        resumeCount: r.resumeCount,
      });
    }
    if (a.submittedAt) {
      items.push({ id: "submitted", at: a.submittedAt, kind: "submitted" });
    }
    items.sort((x, y) => x.at - y.at);
    return items;
  }, [
    a.startedAt,
    a.submittedAt,
    questions,
    answeredEvents,
    incidents,
    messages,
    statusChanges,
    extensions,
    sessionResets,
  ]);

  const remainingMs = Math.max(0, a.expiresAt - now);
  const sinceSeen = Math.max(0, now - a.lastSeenAt);
  const liveDotCls =
    a.status !== "in_progress"
      ? "bg-slate-300"
      : sinceSeen < 15_000
        ? "bg-emerald-500 animate-pulse"
        : sinceSeen < 60_000
          ? "bg-amber-500"
          : "bg-red-500";
  const progressPct =
    a.totalQuestions > 0
      ? Math.round((a.answeredQuestionIds.length / a.totalQuestions) * 100)
      : 0;
  const answeredSet = new Set(a.answeredQuestionIds);

  return (
    <div className="mt-4">
      <header className="rounded-xl border border-default bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${liveDotCls}`} />
            <div>
              <h1 className="text-xl font-bold">{a.userName}</h1>
              <div className="mt-0.5 text-xs text-faint">
                attemptId <code>{a.attemptId.slice(0, 8)}</code> · userId{" "}
                <code>{a.userId?.slice(0, 8) ?? "candidate"}</code>
              </div>
            </div>
            <span
              className={`rounded px-2 py-0.5 text-xs ${STATUS_TONE[a.status]}`}
            >
              {STATUS_LABEL[a.status]}
            </span>
          </div>
          <div className="flex items-center gap-3 text-right">
            <Stat
              label="Còn lại"
              value={
                a.status === "in_progress" ? fmtCountdown(remainingMs) : "—"
              }
              tone={remainingMs < 60_000 && a.status === "in_progress" ? "red" : ""}
            />
            <Stat
              label="Tiến độ"
              value={`${a.answeredQuestionIds.length}/${a.totalQuestions} (${progressPct}%)`}
            />
            <Stat label="Last ping" value={fmtAgo(sinceSeen)} />
            {a.resumeCount > 0 && (
              <Stat label="Resume" value={`×${a.resumeCount}`} />
            )}
          </div>
        </div>

        {(patternFlags.length > 0 || Object.keys(incidentCounts).length > 0) && (
          <div
            data-testid="proctoring-summary"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                Giám sát
              </span>
              {patternFlags.map((f) => (
                <span
                  key={f}
                  data-testid={`pattern-flag-${f}`}
                  className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
                  title={PATTERN_FLAG_LABEL[f] ?? f}
                >
                  {PATTERN_FLAG_LABEL[f] ?? f}
                </span>
              ))}
              {Object.entries(incidentCounts).map(([type, count]) => (
                <span
                  key={type}
                  className="rounded bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200"
                >
                  {INCIDENT_LABEL[type] ?? type}: <b>{count}</b>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1">
          {questions.map((q, i) => {
            const done = answeredSet.has(q.id);
            return (
              <span
                key={q.id}
                title={`Câu ${i + 1}: ${q.prompt}${done ? " · ✓" : ""}`}
                className={`inline-block h-4 w-4 rounded ${
                  done ? "bg-emerald-500" : "bg-slate-200"
                }`}
                data-answered={done ? "true" : "false"}
              />
            );
          })}
        </div>

        <DetailActions a={a} connState={connState} />
      </header>

      <section className="mt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          Timeline ({timeline.length} events)
        </h2>
        <ol
          data-testid="timeline"
          className="mt-2 space-y-1 border-l-2 border-slate-200 pl-4"
        >
          {timeline.map((t) => (
            <TimelineRow key={t.id} t={t} startedAt={a.startedAt} />
          ))}
        </ol>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-faint">
        {label}
      </div>
      <div
        className={`font-mono text-sm ${
          tone === "red" ? "text-red-600" : "text-slate-800"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function TimelineRow({
  t,
  startedAt,
}: {
  t: TimelineEntry;
  startedAt: number;
}) {
  const sinceStart = t.at - startedAt;
  const time = new Date(t.at).toLocaleTimeString("vi-VN");
  const delta = sinceStart >= 0 ? `+${fmtDur(sinceStart)}` : "";
  const meta = `${time} ${delta}`;

  let icon: React.ReactNode = "•";
  let body = "";
  let tone = "text-slate-700";

  switch (t.kind) {
    case "started":
      icon = "▶";
      body = "Bắt đầu thi";
      tone = "text-emerald-700 font-medium";
      break;
    case "answer":
      icon = "✏";
      body = `Trả lời câu ${t.questionOrder + 1}`;
      tone = "text-blue-700";
      break;
    case "incident":
      icon = "⚠";
      body = `${INCIDENT_LABEL[t.iType] ?? t.iType}${
        t.payload ? ` · ${JSON.stringify(t.payload)}` : ""
      }`;
      tone = "text-red-700";
      break;
    case "message":
      icon = t.mKind === "broadcast"
        ? <Megaphone className="h-4 w-4" />
        : <MessageSquare className="h-4 w-4" />;
      body = `${t.mKind === "broadcast" ? "Broadcast" : "Message"}: ${t.body}`;
      tone = "text-amber-700";
      break;
    case "status":
      icon = "⇄";
      body = `Status → ${t.newStatus}`;
      tone = "text-purple-700 font-medium";
      break;
    case "extended":
      icon = "⏱";
      body = `Gia hạn → ${new Date(t.newExpiresAt).toLocaleTimeString("vi-VN")}`;
      tone = "text-indigo-700";
      break;
    case "session_reset":
      icon = <RefreshCw className="h-4 w-4" />;
      body = `Reset session (resume ×${t.resumeCount})`;
      tone = "text-slate-700";
      break;
    case "submitted":
      icon = "■";
      body = "Đã nộp";
      tone = "text-emerald-700 font-medium";
      break;
  }
  return (
    <li className="relative -ml-[10px] flex items-baseline gap-2 pl-[14px] text-sm">
      <span className="absolute -left-[5px] top-1.5 inline-block h-2 w-2 rounded-full bg-slate-300" />
      <span className="font-mono text-[11px] text-faint w-32 shrink-0">
        {meta}
      </span>
      <span className="w-5 shrink-0 text-center">{icon}</span>
      <span className={tone}>{body}</span>
    </li>
  );
}

function DetailActions({
  a,
  connState,
}: {
  a: AttemptCore;
  connState: "connecting" | "open" | "closed";
}) {
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
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-default pt-3">
      <span className="mr-2 inline-flex items-center gap-1.5 text-[11px] text-faint">
        <span className={`h-2 w-2 rounded-full ${connState === "open" ? "animate-pulse bg-emerald-500" : connState === "connecting" ? "animate-pulse bg-amber-400" : "bg-red-500"}`} />
        {connState === "open" ? "Live" : connState === "connecting" ? "Đang kết nối..." : "Mất kết nối"}
      </span>
      <Btn
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
            "Gia hạn +5 phút?",
          )
        }
      >
        +5p
      </Btn>
      <Btn
        disabled={!inProgress || busy !== null}
        loading={busy === "reset"}
        onClick={() =>
          call(
            "reset",
            () =>
              fetch(`/api/exam-attempts/${a.attemptId}/reset-session`, {
                method: "POST",
              }),
            "Reset session lock?",
          )
        }
      >
        Reset session
      </Btn>
      <Btn
        disabled={!inProgress || busy !== null}
        loading={busy === "msg"}
        onClick={() =>
          call("msg", () => {
            const text = window.prompt("Tin nhắn cho sinh viên:")?.trim();
            if (!text) return Promise.resolve(new Response(null, { status: 0 }));
            return fetch(`/api/exam-attempts/${a.attemptId}/messages`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ body: text }),
            });
          })
        }
      >
        <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> Message</span>
      </Btn>
      <Btn
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
      </Btn>
      <Btn
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
      </Btn>
      {err && (
        <span className="inline-flex items-center gap-1 text-[11px] text-red-700"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {err}</span>
      )}
    </div>
  );
}

function Btn({
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
      className={`rounded border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}
    >
      {loading ? "…" : children}
    </button>
  );
}

function fmtCountdown(ms: number): string {
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0)
    return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function fmtDur(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m${sec.toString().padStart(2, "0")}s`;
}

function fmtAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 5) return "vừa xong";
  if (s < 60) return `${s}s trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}p trước`;
  return `${Math.floor(m / 60)}h trước`;
}
